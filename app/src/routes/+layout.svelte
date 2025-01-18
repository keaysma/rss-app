<script lang="ts">
	import '@picocss/pico/css/pico.css';
	import '@picocss/pico/css/pico.colors.min.css';
	import '/src/global.scss';

	import type { MessagePayload, MessageResponse, WorkerContextState, WorkerInterface } from '$lib/types';
	import initWorker from '$lib/loadWorker';
	import { onMount, setContext } from 'svelte';

	let { children } = $props();

	let worker: WorkerInterface | null = $state(null);
	let onMessage = $state<WorkerContextState>({
		callback: () => () => {},
		ready: false
	});

	onMount(async () => {
		worker = await initWorker(handleWorkerMessage);
		worker.postMessage({ message: 'upgrade' });
		(window as any).nukeDatabase = () => {
			if (worker !== null && confirm('Are you sure you want to')) {
				worker?.postMessage({ message: 'dev-nuke' });
			}
		};
	});

	const postMessage = (message: MessagePayload) => {
		if (worker !== null) {
			worker.postMessage(message);
		}
	};
	setContext('postMessage', postMessage);
	setContext('onMessageConnector', onMessage);

	const handleWorkerMessage = (event: MessageEvent<MessageResponse>) => {
		console.log(event.data);
		switch (event.data.message) {
			case 'pong':
				console.log('pong');
				break;
			case 'upgraded':
				console.log('upgraded');
				onMessage.ready = true;
				break;
			default:
				// console.log('unknown message', event.data);
				onMessage.callback(event);
		}
	};
</script>

{@render children()}
