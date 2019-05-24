const fs = require('fs');
const path = require('path');
const utils = require('./utils')

const { TelegramBot, FileSessionStore } = require('bottender');
const { createServer } = require('bottender/express');
const config = require('./bottender.config.js').telegram;
const Handlers = require('./handlers');

const bot = new TelegramBot({
	accessToken: config.accessToken,
	sessionStore: new FileSessionStore()
});

const status_vocab = {
	'continue': 0,
	'interrapt': 1,
	'repeat': 3
}


//const locals_info = utils.readFilesSync('local')
const locals =  require('./local/local.json')

class ReplyMarkup {
	constructor() {
		this.opts = {
			reply_markup: {
				inline_keyboard: [[]]
			}
		};
		this.reply_markup = this.opts.reply_markup;
		this.inline_keyboard = this.opts.reply_markup.inline_keyboard[0];
	}

	addButton({handler, text, action, value}) {
		this.inline_keyboard.push({text, callback_data: this.createCallbackData(handler, action, value, 'button')});
	}

	build() {
		return this.opts
	}

	createCallbackData(handler, action, value, type) {
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

	use(context) {
		let state = context.state;
		let result = {
			'text': 'Technical problems :(',
			'status': status_vocab.continue,
			'opts': {}
		}
		let local = (state.lang) ? locals[state.lang] : null;
		let event = context.event || null;
		let payload = event ? event.payload : '';
		let callbackData = {
			handler: 'default',
			action: 'default',
			value: 'default',
			type: 'default'
		}
		if (!local) {
			callbackData.handler = 'local';
			callbackData.action = 'def';
		}
		if (payload) {
			callbackData = ReplyMarkup.parseCallbackData(payload);
		}
		result = this.handlers.reduce((prevRes, handler, index) => {
			console.log(
				'callbackData - ', callbackData,
				'context - ', context,
				'state - ', context.state
			)
			if ((prevRes.status == status_vocab.interrapt) ||
				(prevRes.status == status_vocab.repeat)) {
				return prevRes
			}
			let handlerRes = handler.handle(prevRes, callbackData, context, local);
			console.log('res -',handlerRes || prevRes)
			console.log('-----------------------------')
			return handlerRes || prevRes
		},  result)
		return result
	}
}

handlerParams = {
	status_vocab,
	ReplyMarkup,
	config
}
diagnosticParams = Object.assign(handlerParams, {
	skinModelPath: 'file://vendors/Skin-Lesion-Analyzer/final_model_kaggle_version1/model.json'
});
const handlerManager = new HandlerManager([
	new Handlers.LocalHandler(handlerParams),
	new Handlers.DiagnosticHandler(diagnosticParams),
	new Handlers.DefaultHandler(handlerParams)
])

bot.setInitialState({
	lang: null,
	diagnostic: null
});

bot.onEvent(async context => {
	let result
	do {
		result = handlerManager.use(context)
	} while (result.status == status_vocab.repeat);
	await context.sendMessage(result.text, result.opts);
	// const opts = {
	// 	// remove_keyboard: true,
	// 	reply_markup: {
	// 	  inline_keyboard: [
	// 		[
	// 		  {
	// 			text: 'Edit Text',
	// 			callback_data: 'edit'
	// 		  }
	// 		]
	// 	  ],
	// 		// keyboard: [
	// 		// 	['Opt1'],
	// 		// 	['Opt2']
	// 		// ],
	// 		// one_time_keyboard: true,
	// 	//   remove_keyboard: true
	// 	}
	//   };

	// // console.log(context)
	// if (context.event.isPhoto) {
	// 	await context.sendMessage('I know this is a photo.');
	// } else if (
	// 	context.event.callbackQuery === 'A_DEVELOPER_DEFINED_CALLBACK_QUERY'
	// ) {
	// 	await context.sendMessage('I know this is a callback query.');
	// } else {
	// 	await context.sendMessage('I do not understand.');
	// }
});

bot.createLongPollingRuntime({
	limit: 10, // Limits the number of updates to be retrieved. Defaults to 100.
	timeout: 2, // Timeout in seconds for long polling. Defaults to 0.
	allowed_updates: ['message', 'callback_query'], // List the types of updates you want your bot to receive
});

// const server = createServer(bot, { ngrok: true });

// server.listen(5000, () => {
// 	console.log('server is running on 5000 port...');
// });
