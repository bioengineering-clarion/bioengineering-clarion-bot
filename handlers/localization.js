Handler = require('./handler');

class LocalHandler extends Handler {
	constructor(paprams) {
		super(paprams);
		this.name = 'local';
		this.isSetting = true;
		this.locals = paprams.localJson;
	}

	async handle(result, callbackData, context, local, defaultCallbackData) {
		if (callbackData.handler !== this.name) {
			return result;
		}
		switch (callbackData.action) {
			case 'ask':
				return this.defaultAsk(result, context, local);
			case 'set_lang':
				context.setState({lang: callbackData.value});
				Object.assign(callbackData, defaultCallbackData);
				result.status = this.status_vocab.repeat;
				return result
		}
	}

	defaultAsk(result, context, local) {
		let replyMarkup = new this.ReplyMarkup();
		for (let localId in this.locals) {
			let local = this.locals[localId];
			replyMarkup.addButton({
				handler: this.name,
				text: local.name,
				action: 'set_lang',
				value: localId
			})

		}
		result.text = 'Choose language!';
		result.opts = replyMarkup.build();
		result.status =  this.status_vocab.interrapt;

		return result
	}
}

module.exports = LocalHandler