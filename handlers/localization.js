Handler = require('./handler');

class LocalHandler extends Handler {
	constructor(paprams) {
		super(paprams);
		this.name = 'local';
		this.locals = paprams.localJson;
	}

	static get isSetting() {
		return true;
	}

	setSettingValue(context, value) {
		context.setState({lang: value});
	}

	async handle(result, callbackData, context, local, defaultCallbackData) {
		if (callbackData.handler !== this.name) {
			return result;
		}
		switch (callbackData.action) {
			case 'open':
				return this.defaultAsk(result, context, local);
			case 'set_value':
				this.setSettingValue(context, callbackData.value);
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
				action: 'set_value',
				value: localId
			});
		}
		result.text = 'Choose language!';
		result.opts = replyMarkup.build();
		result.status =  this.status_vocab.interrapt;

		return result
	}
}

module.exports = LocalHandler