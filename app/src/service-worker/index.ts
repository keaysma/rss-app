/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', (event) => {
	console.log("installed", event);
});

sw.addEventListener('activate', (event) => {
	console.log("activate", event);
});

sw.addEventListener('fetch', (event) => {
	const onFetch = async () => {
		console.log({ request: event.request });

		const response = await fetch(event.request);

		return response;
	}

	event.respondWith(onFetch());
});

sw.addEventListener('online', (event) => {
	console.log("online", event);
});

sw.addEventListener('offline', (event) => {
	console.log("offline", event);
});
