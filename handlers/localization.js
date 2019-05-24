Handler = require('./handler');

class LocalHandler extends Handler {
	constructor(paprams) {
		super(paprams);
		this.name = 'local';
	}

	handle(result, callbackData, context, local) {
		if (callbackData.handler !== this.name) {
			return;
		}
		switch (callbackData.action) {
			case 'def':
				let replyMarkup = new this.ReplyMarkup();
				locals.forEach(local => {
                    replyMarkup.addButton({
                        handler: this.name,
                        text: local.name,
                        action: 'set_lang',
                        value: local.id
                    })
				})
				result.text = 'Choose language!';
				result.opts = replyMarkup.build();
				result.status =  this.status_vocab.interrapt;
				break;
			case 'set_lang':
				context.setState({lang: callbackData.value});
				result.status =  this.status_vocab.repeat;
				break;
		}

		return result
	}
}

module.exports = LocalHandler