Handler = require('./handler');

class DefaultHandler extends Handler {
	constructor(paprams) {
		super(paprams);
		this.name = 'default';
	}

	handle(result, callbackData, context, local) {
		result.text = local.bot['description'];
		let replyMarkup = new this.ReplyMarkup(this.name);
		replyMarkup.addButton({
            handler: 'diagnostic',
            text: local.bot['skin_diagnostic_btn'],
            action: 'skin'
        });
        replyMarkup.addButton({
            handler: 'profile',
            text: local.bot['profile'],
            action: 'open'
        })
		result.opts = replyMarkup.build();
		return result
	}
}

module.exports = DefaultHandler