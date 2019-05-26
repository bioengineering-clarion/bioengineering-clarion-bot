Handler = require('./handler');

class DefaultHandler extends Handler {
	constructor(paprams) {
		super(paprams);
		this.name = 'default';
	}

	handle(result, callbackData, context, local, defaultCallbackData) {
		if (callbackData.handler !== this.name) {
			return result;
		}
		result.text = local.get('bot.description');
		let replyMarkup = new this.ReplyMarkup();
		replyMarkup.addButton({
            handler: 'diagnostic',
            text: local.get('bot.diagnostic.skin.enter_btn'),
            action: 'skin'
        });
        replyMarkup.addButton({
            handler: 'profile',
            text: local.get('bot.profile_btn'),
            action: 'open'
        })
		result.opts = replyMarkup.build();
		return result
	}
}

module.exports = DefaultHandler