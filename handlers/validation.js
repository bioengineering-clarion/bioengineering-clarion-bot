Handler = require('./handler');

class ValidationHandler extends Handler {
	constructor(paprams) {
		super(paprams);
		this.name = 'validation';
		this.channelName = paprams.channelName;
		this.channelId = paprams.channelId;
	}

	async handle(result, callbackData, context, local, defaultCallbackData) {
		await this._isInChannel(result, context, local)
		return result;
	}

	async _isInChannel(result, context, local) {
		let userId = context.session.user.id;
		result = await context._client.getChatMember(this.channelId, userId);
		if (result.status == 'left') {
			context.setState({inChannel: false});
		} else {
			context.setState({inChannel: true});
		}
	}
}

module.exports = ValidationHandler