const fs = require('fs');
const path = require('path');

const { TelegramBot, FileSessionStore } = require('bottender');
const { createServer } = require('bottender/express');
const config = require('./bottender.config.js').telegram;
const Handlers = require('./handlers');
const Local = require('./local/local.js');

const bot = new TelegramBot({
	accessToken: config.accessToken,
	sessionStore: new FileSessionStore()
});

const status_vocab = {
	'continue': 0,
	'interrapt': 1,
	'repeat': 3
}


class ReplyMarkup {
	constructor(opts) {
		if (!opts) {
			this.opts = {
				reply_markup: {
					inline_keyboard: [[]]
				}
			};
		}
		else {
			this.opts = Object.assign({}, opts);
		}
		this.reply_markup = this.opts.reply_markup;
		this.inline_keyboard = this.reply_markup.inline_keyboard[0];
		this.paramMap = {
			handler: 'h',
			action: 'a',
			value: 'v',
			type: 't'
		}
	}

	addButton({handler, text, action, value}) {
		this.inline_keyboard.push({text, callback_data: this.createCallbackData({handler, action, value, type: 'button'})});
	}

	nextLine() {
		this.reply_markup.inline_keyboard.push([]);
		let lastIdx = this.reply_markup.inline_keyboard.length - 1;
		this.inline_keyboard = this.reply_markup.inline_keyboard[lastIdx];
	}

	changeParam(paramName, value, isPrefix=false) {
		this.inline_keyboard = this.inline_keyboard.map(item => {
			let callbackData = ReplyMarkup.parseCallbackData(item.callback_data);
			callbackData[paramName] = isPrefix ? value + callbackData[paramName] : value;
			item.callback_data = this.createCallbackData(callbackData);
			return item;
		})
	}

	addParamPrefix(paramName, prefix) {
		this.changeParam(paramName, prefix, true);
	}

	build() {
		return this.opts
	}

	createCallbackData({handler, action, value, type}) {
		return JSON.stringify({h: handler, a: action, v: value || '', t: type});
	}

	static parseCallbackData(dataString) {
		let data = JSON.parse(dataString);
		return {
			handler: data.h,
			action: data.a,
			value: data.v,
			type: data.t
		}
	}
}

class HandlerManager {
	constructor(handlers) {
		this.handlers = handlers
	}

	async use(context, callbackData, defaultCallbackData) {
		let state = context.state;
		let result = {
			'text': 'Technical problems :(',
			'status': status_vocab.continue,
			'opts': {}
		}
		let local = (state.lang) ? new Local(state.lang) : null;
		for (let i = 0; i < this.handlers.length; i += 1) {
			let handler = this.handlers[i];
			if ((result.status == status_vocab.interrapt) ||
				(result.status == status_vocab.repeat)) {
				continue;
			}
			result = await handler.handle(result, callbackData, context, local, defaultCallbackData);
		}
		return result
	}
}

const handlerParams = {
	status_vocab,
	ReplyMarkup,
	config
}
const diagnosticParams = Object.assign(handlerParams, {
	skinModelPath: 'file://model/model.json'
});
let localHandler = new Handlers.LocalHandler(Object.assign(handlerParams, {localJson: Local.localJson}));
const handlerManager = new HandlerManager([
	localHandler,
	new Handlers.ValidationHandler(Object.assign(handlerParams, {
		channelName: '@bioengineering_clarion_channel',
		channelId: '-1001183795472'
	})),
	new Handlers.DiagnosticHandler(diagnosticParams),
	new Handlers.ProfileHandler(Object.assign(handlerParams, {settings: [localHandler]})),
	new Handlers.DefaultHandler(handlerParams)
])

bot.setInitialState({
	lang: null,
	diagnostic: null,
	lastMessId: null,
	diagnosticCount: 0,
	statistic: {
		correct: 0,
		uncorrect: 0
	},
	inChannel: null
});

bot.onEvent(async context => {
	let result
	let defaultCallbackData = {
		handler: 'default',
		action: 'default',
		value: 'default',
		type: 'default'
	}
	let callbackData = Object.assign({}, defaultCallbackData);
	let event = context.event || null;
	let payload = event ? event.payload : '';
	if (payload) {
		callbackData = ReplyMarkup.parseCallbackData(payload);
	}
	if (!context.state.lang && (callbackData.handler !== 'local')) {
		callbackData.handler = 'local';
		callbackData.action = 'open';
	}
	do {
		result = await handlerManager.use(context, callbackData, defaultCallbackData);
	} while (result.status == status_vocab.repeat);
	result.opts.parse_mode = 'Markdown'
	result.opts.disable_web_page_preview = true;
	result.opts.disable_notification = true;
	//result.text = '[Привет](http://t.com)'
	var mess = null;
	if (result.photo) {
		result.opts.caption = result.text;
		mess = await context.sendPhoto(result.photo, result.opts);
	} else {;
		mess = await context.sendMessage(result.text, result.opts);
	}
	if (mess) {
		context.setState({lastMessId: mess.message_id});
	}
});

bot.createLongPollingRuntime({
	limit: 10, // Limits the number of updates to be retrieved. Defaults to 100.
	timeout: 0, // Timeout in seconds for long polling. Defaults to 0.
	allowed_updates: ['message', 'callback_query'], // List the types of updates you want your bot to receive
});

// const server = createServer(bot);

// server.listen(5000, () => {
// 	console.log('server is running on 5000 port...');
// });
