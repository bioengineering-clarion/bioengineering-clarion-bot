const Handler = require('./handler');
const tf = require('@tensorflow/tfjs-node');
const fetch = require('node-fetch');
const fs = require('fs');
const {Image, createCanvas, ImageData} = require('canvas');
const SKIN_CLASSES = {
    0: 'akiec, Actinic Keratoses (Solar Keratoses) or intraepithelial Carcinoma (Bowen’s disease)',
    1: 'bcc, Basal Cell Carcinoma',
    2: 'bkl, Benign Keratosis',
    3: 'df, Dermatofibroma',
    4: 'mel, Melanoma',
    5: 'nv, Melanocytic Nevi',
    6: 'vasc, Vascular skin lesion'
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
	handle(result, callbackData, context, local) {
        if (callbackData.handler == this.name) {
            switch (callbackData.action) {
                case 'skin':
                    result.text = local.bot['skin_load_photo'];
                    result.status =  this.status_vocab.interrapt;
                    context.setState({diagnostic: 'wait_skin_photo'});
                    break;
            }
            return result;
        }
        if (context.state.diagnostic) {
            switch (context.state.diagnostic) {
                case 'wait_skin_photo':
                    if (context.event.isPhoto) {
                        if (this.skinModel) {
                            this._processSkinPhoto(context.event.photo);
                        } else {
                            result.text = local.bot['model_loading_message'];
                        }
                    } else {
                        result.text = local.bot['wait_skin_photo'];
                    }

                    result.status =  this.status_vocab.interrapt;
                    break;
            }
            return result;
        }
    }

    async _processSkinPhoto(photos) {
        let photoInfo = photos.find(element => {
            return (element.height >= this.min_size) && (element.width >= this.min_size);
        });
        let photoPath = await this._getPhotoPath(photoInfo);
        let tensor = await this._photoPathToTensor(photoPath, photoInfo);
        tensor = this._cropTensor(tensor, photoInfo);
        let result = await this._skinPredict(tensor);

        await this._writeToFile(tensor, createCanvas(tensor.shape[0], tensor.shape[1]));
    }

    async _skinPredict(tensor) {
        tensor = tensor.resizeNearestNeighbor([224, 224]);
        tensor = tensor.toFloat()
        let offset = tf.scalar(127.5);
        tensor = tensor.sub(offset)
            .div(offset)
            .expandDims();
        let predictions = await this.skinModel.predict(tensor).data();
        let top5 = Array.from(predictions)
            .map(function (p, i) { // this is Array.map
                return {
                    probability: p,
                    className: SKIN_CLASSES[i] // we are selecting the value from the obj
                };
            }).sort(function (a, b) {
                return b.probability - a.probability;
            });

        return top5;
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
        const canvas = createCanvas(photoInfo.width, photoInfo.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        let tensor = tf.browser.fromPixels(canvas);

        return tensor
    }

    async _writeToFile(tensor, canvas) {
        let bytes = await tf.browser.toPixels(tensor);
        const ctx = canvas.getContext('2d');
        const imageData = new ImageData(bytes, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
        var buf = canvas.toBuffer();
        fs.writeFile('logo1.png', buf,  function(err){
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