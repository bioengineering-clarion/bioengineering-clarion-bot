const Handler = require('./handler');
const tf = require('@tensorflow/tfjs-node');
const fetch = require('node-fetch');
const fs = require('fs');
const {Image, createCanvas, ImageData} = require('canvas');
const SKIN_CLASSES = {
    0: 'akiec',
    1: 'bcc',
    2: 'bkl',
    3: 'df',
    4: 'mel',
    5: 'nv',
    6: 'vasc'
};

class DiagnosticHandler extends Handler {
	constructor(paprams) {
		super(paprams);
        this.name = 'diagnostic';
        this.skinModel = null;
        this.min_size = 224;
        tf.modelFromJSON
        tf.loadLayersModel(paprams.skinModelPath).then(model => {
            this.skinModel = model;
        });
    }

	async handle(result, callbackData, context, local, defaultCallbackData) {
        if (callbackData.handler == this.name) {
            context.setState({diagnostic: null});
            switch (callbackData.action) {
                case 'skin':
                    result = this.defaultAsk(result, context, local);
                    context.setState({diagnostic: 'wait_skin_photo'});
                    break;
                case 'skin_more':
                    result.text = local.get('bot.diagnostic.skin.more');
                    let replyMarkup = new this.ReplyMarkup();
                    replyMarkup.addButton({
                        handler: 'diagnostic',
                        text: local.get('bot.back_btn'),
                        action: 'skin'
                    });
                    result.opts = replyMarkup.build();
                    break;
                case 'back':
                    if (callbackData.value == 'main') {
                        result = this.defaultAsk(result, context, local);
                        context.setState({diagnostic: 'wait_skin_photo'});
                    } else {
                        Object.assign(callbackData, defaultCallbackData);
                        result.status = this.status_vocab.repeat;
                    }
                    break;
            }
            return result;
        }

        if (context.state.diagnostic) {
            switch (context.state.diagnostic) {
                case 'wait_skin_photo':
                    let skinLocalPath = 'bot.diagnostic.skin.predictions';
                    if (context.event.isPhoto || context.event.isDocument) {
                        if (this.skinModel) {
                            result.text = 'Результат:\n';
                            let predictions = await this._processSkinPhoto(context.event.photo || context.event.document);
                            predictions.slice(0, 3).forEach(pred => {
                                let percentStr = (pred.probability * 100).toFixed(2).toString() + '%';
                                let symbolsCount = percentStr.length;
                                percentStr = percentStr + " ".repeat(6 - symbolsCount);
                                let className = local.get(skinLocalPath + '.' + pred.className);
                                result.text += `${percentStr} - ${className} \n`;
                            });
                            result.status = this.status_vocab.interrapt;

                            let replyMarkup = new this.ReplyMarkup();
                            replyMarkup.addButton({
                                handler: 'diagnostic',
                                text: local.get('bot.back_btn'),
                                action: 'skin'
                            });
                            result.opts = replyMarkup.build();
                            // context.setState({diagnostic: null});
                        } else {
                            result.text = local.get('bot.diagnostic.model_loading_message');
                        }
                        return result;
                    } else {
                        return this.defaultAsk(result, context, local);
                    }
                    break;
            }
        }

        return result;
    }

    defaultAsk(result, context, local) {
        result.text = local.get('bot.diagnostic.skin.description');
        result.photo = 'https://i.ibb.co/Xyv2wpY/IMG-9577.png'
        result.status =  this.status_vocab.interrapt;
        result = this.addFooter(result, context, local);

        return result;
    }

    addFooter(result, context, local) {
        let replyMarkup = new this.ReplyMarkup();
        replyMarkup.addButton({
            handler: 'diagnostic',
            text: local.get('bot.back_btn'),
            action: 'back'
        });
        replyMarkup.addButton({
            handler: 'diagnostic',
            text: local.get('bot.more_btn'),
            action: 'skin_more'
        });
        result.opts = replyMarkup.build();

        return result
    }

    async _processSkinPhoto(photos) {
        var photoInfo;
        if (Array.isArray(photos)) {
            photoInfo = photos.find(element => {
                return (element.height >= this.min_size) && (element.width >= this.min_size);
            });
        } else {
            photoInfo = photos;
        }
        let photoPath = await this._getPhotoPath(photoInfo);
        let tensor = await this._photoPathToTensor(photoPath, photoInfo);
        tensor = this._cropTensor(tensor, {height: tensor.shape[0], width: tensor.shape[1]});

        // this._writeToFile(tensor);
        let result = await this._skinPredict(tensor);

        return result;
    }

    async _skinPredict(tensor) {
        tensor = tensor.resizeNearestNeighbor([224, 224]);
        tensor = tensor.toFloat()
        let offset = tf.scalar(127.5);
        tensor = tensor.sub(offset)
            .div(offset)
            .expandDims();
        let predictions = await this.skinModel.predict(tensor).data();
        let sortedPredictions = Array.from(predictions)
            .map(function (p, i) { // this is Array.map
                return {
                    probability: p,
                    className: SKIN_CLASSES[i] // we are selecting the value from the obj
                };
            }).sort(function (a, b) {
                return b.probability - a.probability;
            });

        return sortedPredictions;
    }

    async _getPhotoPath(photoInfo) {
        let accessToken = this.config.accessToken;
        let file_id = photoInfo.file_id;
        let res = await fetch(`https://api.telegram.org/bot${accessToken}/getFile?file_id=${file_id}`);
        res = await res.json();
        let photoPath = res.result.file_path

        return photoPath
    }

    async _photoPathToTensor(photoPath, photoInfo) {
        let img = new Image();
        let accessToken = this.config.accessToken;
        img.src = `https://api.telegram.org/file/bot${accessToken}/${photoPath}`;
        await new Promise((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = err => reject(err)
        });
        // const download = require('image-downloader')
        // await download.image({
        //     url: `https://api.telegram.org/file/bot${accessToken}/${photoPath}`,
        //     dest: 'res.jpg'
        //   })
        // TODO: Cache canvas operations.
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        let tensor = tf.browser.fromPixels(canvas);

        return tensor;
    }

    async _writeToFile(tensor) {
        let canvas = createCanvas(tensor.shape[1], tensor.shape[0]);
        let bytes = await tf.browser.toPixels(tensor);
        const ctx = canvas.getContext('2d');
        const imageData = new ImageData(bytes, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
        var buf = canvas.toBuffer();
        fs.writeFile('res.jpg', buf,  function(err){
            if (err) throw err
            console.log('File saved.')
        })
    }

    _cropTensor(tensor, photoInfo) {
        let sliceOffset = Math.max(photoInfo.height, photoInfo.width) - Math.min(photoInfo.height, photoInfo.width);
        let halfDiff = ~~(sliceOffset / 2);
        let padDiff = sliceOffset % 2;
        var startShape = [0, 0, 0];
        var endShape = [photoInfo.height, photoInfo.width, 3];
        if (photoInfo.height !== photoInfo.width) {
            if (photoInfo.height > photoInfo.width) {
                startShape = [halfDiff + padDiff, 0, 0];
                endShape = [photoInfo.width, photoInfo.width, 3];
            } else {
                startShape = [0, halfDiff + padDiff, 0];
                endShape = [photoInfo.height, photoInfo.height, 3];
            }
        }
        tensor = tensor.slice(startShape, endShape);

        return tensor;
    }
}

module.exports = DiagnosticHandler