Handler = require('./handler');

class ProfileHandler extends Handler {
	constructor(paprams) {
		super(paprams);
		this.name = 'profile';
		this.settings = paprams.settings;
	}

	handle(result, callbackData, context, local, defaultCallbackData) {
		if (callbackData.handler !== this.name) {
			return result;
		}
		var setting;
		switch (callbackData.action) {
			case 'open':
				result = this.defaultAsk(result, context, local);
				break;
			case 'setting':
				setting = this.settings.find(el => el.name === callbackData.value);
				let settingResult = setting.defaultAsk({});
				let replyMarkup = new this.ReplyMarkup(settingResult.opts);
				replyMarkup.changeParam('handler', this.name);
				replyMarkup.addParamPrefix('value', setting.name + '__' );
				settingResult.opts = replyMarkup.build();
				return settingResult;
			case 'set_value':
				let [handlerName, value] = callbackData.value.split('__');
				setting = this.settings.find(el => el.name === handlerName);
				setting.setSettingValue(context, value);
				result = this.defaultAsk(result, context, local);
				break;
		}
		result = this.addFooter(result, context, local);
		return result;
	}

	defaultAsk(result, context, local) {
		let replyMarkup = new this.ReplyMarkup();
		for (let i = 0; i < this.settings.length; i += 1) {
			let setting = this.settings[i];
			replyMarkup.addButton({
				handler: this.name,
				text: local.get('bot.profile.' + setting.name + '_btn'),
				action: 'setting',
				value: setting.name
			})
		}
		result.text = local.get('bot.profile.description');
		result.opts = replyMarkup.build();

		return result;
	}

	addFooter(result, context, local) {
		let replyMarkup = new this.ReplyMarkup(result.opts);
		replyMarkup.nextLine();
        replyMarkup.addButton({
            handler: 'default',
            text: local.get('bot.back_btn'),
            action: 'default'
        });
        result.opts = replyMarkup.build();

        return result
    }
}

module.exports = ProfileHandler