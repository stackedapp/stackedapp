import { ViewStore } from '../store';
import * as uuid from 'uuid';
import * as Message from '../message';

export function createListeners({ store }: { store: ViewStore }): void {
	window.addEventListener('keydown', e => {
		if (e.key === 'Meta') {
			store.setMetaDown(true);
		}
	});

	window.addEventListener('keyup', e => {
		if (e.key === 'Meta') {
			store.setMetaDown(false);
		}
	});

	window.addEventListener(
		'focus',
		() => {
			const project = store.getProject();

			store.getSender().send({
				id: uuid.v4(),
				type: Message.MessageType.WindowFocused,
				payload: {
					app: store.getApp().toJSON(),
					projectId: project ? project.getId() : undefined
				}
			});

			store
				.getApp()
				.setHasFocusedInput(
					['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase())
				);
		},
		true
	);

	window.addEventListener(
		'blur',
		() => {
			const project = store.getProject();

			store.getSender().send({
				id: uuid.v4(),
				type: Message.MessageType.WindowBlured,
				payload: {
					app: store.getApp().toJSON(),
					projectId: project ? project.getId() : undefined
				}
			});

			store.getApp().setHasFocusedInput(false);
		},
		true
	);

	// Disable drag and drop from outside the application
	document.addEventListener(
		'dragenter',
		event => {
			event.preventDefault();
		},
		false
	);

	document.addEventListener(
		'dragover',
		event => {
			event.dataTransfer.dropEffect = 'none';
			event.preventDefault();
		},
		false
	);

	document.addEventListener(
		'drop',
		event => {
			event.preventDefault();
		},
		false
	);
}
