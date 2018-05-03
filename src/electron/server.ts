import { EventEmitter } from 'events';
import * as express from 'express';
import * as Http from 'http';
import { ServerMessageType } from '../message';
import * as Path from 'path';
import { patternIdToWebpackName } from '../preview/pattern-id-to-webpack-name';
import { previewDocument } from '../preview/preview-document';
import * as QueryString from 'query-string';
import { Store } from '../store/store';
import { Styleguide } from '../store/styleguide/styleguide';
import * as uuid from 'uuid';
import * as webpack from 'webpack';
import { OPEN, Server as WebsocketServer } from 'ws';

// memory-fs typings on @types are faulty
const MemoryFs = require('memory-fs');

const PREVIEW_PATH = require.resolve('../preview/preview');
const LOADER_PATH = require.resolve('../preview/components-loader');
const RENDERER_PATH = require.resolve('../preview/preview-renderer');

export interface ServerOptions {
	port: number;
}

interface StyleguidePattern {
	[key: string]: string;
}

interface State {
	id: string;
	payload: {
		elementId?: string;
		// tslint:disable-next-line:no-any
		page?: any;
	};
	type: 'state';
}

enum WebpackMessageType {
	Start = 'start',
	Done = 'done',
	Error = 'error'
}

interface WebpackMessage {
	id: string;
	payload?: object;
	type: WebpackMessageType;
}

// tslint:disable-next-line:no-any
type Queue = WebpackMessage[];

export async function createServer(opts: ServerOptions): Promise<EventEmitter> {
	const store = Store.getInstance();
	store.openFromPreferences();

	const emitter = new EventEmitter();
	const app = express();

	const server = Http.createServer(app);
	const wss = new WebsocketServer({ server });

	const state: State = {
		id: uuid.v4(),
		type: 'state',
		payload: {}
	};

	// tslint:disable-next-line:no-any
	const compilation: any = {
		path: '',
		queue: [],
		listeners: []
	};

	// Prevent client errors (frequently caused by Chrome disconnecting on reload)
	// from bubbling up and making the server fail, ref: https://github.com/websockets/ws/issues/1256
	wss.on('connection', ws => {
		ws.on('error', err => {
			console.error(err);
		});

		ws.on('message', message => emitter.emit('client-message', message));
		ws.send(JSON.stringify(state));
	});

	app.get('/preview.html', (req, res) => {
		res.type('html');
		res.send(previewDocument);
	});

	app.use('/scripts', (req, res, next) => {
		const [current] = compilation.queue;

		if (!current) {
			next();
			return;
		}

		// tslint:disable-next-line:no-any
		const onReady = (fs: any): void => {
			compilation.listeners = compilation.listeners.filter(l => l !== onReady);

			try {
				res.type('js');
				res.send(fs.readFileSync(req.path));
			} catch (err) {
				if (err.code === 'ENOENT') {
					res.sendStatus(404);
					return;
				}
				res.sendStatus(500);
			}
		};

		if (current.type === 'start') {
			compilation.listeners.push(onReady);
		} else {
			onReady(compilation.compiler.outputFileSystem);
		}
	});

	// tslint:disable-next-line:no-any
	const send = (message: any): void => {
		wss.clients.forEach(client => {
			if (client.readyState === OPEN) {
				client.send(JSON.stringify(message));
			}
		});
	};

	// tslint:disable-next-line:no-any
	emitter.on('message', async (message: any) => {
		switch (message.type) {
			case ServerMessageType.StyleGuideChange: {
				const { payload } = message;
				if (compilation.path !== payload.styleguidePath) {
					if (compilation.compiler && typeof compilation.compiler.close === 'function') {
						compilation.compiler.close();
					}

					send({
						type: 'reload',
						id: uuid.v4(),
						payload: {}
					});

					state.id = uuid.v4();
					state.payload = {};
					const next = await setup({
						analyzerName: payload.analyzerName,
						styleguidePath: payload.styleguidePath,
						patternsPath: payload.patternsPath
					});
					compilation.path = payload.styleguidePath;
					compilation.compiler = next.compiler;
					compilation.queue = next.queue;
					compilation.listeners = [];

					next.compiler.hooks.watchRun.tap('alva', () => {
						send({
							type: 'update',
							id: uuid.v4(),
							payload: {}
						});
					});

					next.compiler.hooks.done.tap('alva', stats => {
						compilation.listeners.forEach(l => l(compilation.compiler.outputFileSystem));
					});
				}
				break;
			}

			case ServerMessageType.PageChange: {
				state.payload.page = message.payload;
				send(state);
				break;
			}

			case ServerMessageType.ElementChange: {
				state.payload.elementId = message.payload;
				send(message);
				break;
			}

			case ServerMessageType.BundleChange: {
				send({
					type: 'reload',
					id: uuid.v4(),
					payload: {}
				});
				break;
			}

			case ServerMessageType.AppLoaded: {
				break;
			}

			case ServerMessageType.SketchExportRequest:
			case ServerMessageType.ContentRequest: {
				send(message);
				break;
			}

			default: {
				console.warn(`Unknown message type: ${message.type}`);
			}
		}
	});

	await startServer({
		server,
		port: opts.port
	});

	return emitter;
}

interface ServerStartOptions {
	port: number;
	server: Http.Server;
}

// tslint:disable-next-line:promise-function-async
function startServer(options: ServerStartOptions): Promise<void> {
	return new Promise((resolve, reject) => {
		options.server.once('error', reject);
		options.server.listen(options.port, resolve);
	});
}

// tslint:disable-next-line:no-any
async function setup(update: any): Promise<any> {
	const queue: Queue = [];
	const init: StyleguidePattern = {};

	const styleguide = new Styleguide(
		update.styleguidePath,
		update.patternsPath,
		update.analyzerName
	);

	const context = styleguide.getPath();

	const components = styleguide.getPatterns().reduce((componentMap, pattern) => {
		const patternPath = pattern.getImplementationPath();

		if (!patternPath) {
			return componentMap;
		}

		componentMap[patternIdToWebpackName(pattern.getId())] = `./${Path.relative(
			context,
			patternPath
		)
			.split(Path.sep)
			.join('/')}`;
		return componentMap;
	}, init);

	const compiler = webpack({
		mode: 'development',
		context,
		entry: {
			components: `${LOADER_PATH}?${QueryString.stringify({
				cwd: context,
				components: JSON.stringify(components)
			})}!`,
			renderer: RENDERER_PATH,
			preview: PREVIEW_PATH
		},
		output: {
			filename: '[name].js',
			library: '[name]',
			libraryTarget: 'window',
			path: '/'
		},
		optimization: {
			splitChunks: {
				cacheGroups: {
					vendor: {
						chunks: 'initial',
						name: 'vendor',
						test: /node_modules/,
						priority: 10,
						enforce: true
					}
				}
			}
		},
		plugins: [new webpack.HotModuleReplacementPlugin()]
	});

	compiler.outputFileSystem = new MemoryFs();

	compiler.hooks.compile.tap('alva', () => {
		queue.unshift({ type: WebpackMessageType.Start, id: uuid.v4() });
	});

	compiler.hooks.done.tap('alva', stats => {
		if (stats.hasErrors()) {
			queue.unshift({
				type: WebpackMessageType.Error,
				payload: stats.toJson('errors-only'),
				id: uuid.v4()
			});
		}
		queue.unshift({ type: WebpackMessageType.Done, id: uuid.v4() });
	});

	// tslint:disable-next-line:no-empty
	compiler.watch({}, (err, stats) => {});

	return {
		compiler,
		queue
	};
}
