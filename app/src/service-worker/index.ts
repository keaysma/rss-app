/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;
// import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

import { build, files, version } from '$service-worker';

const initializeSqlite = async () => {
	console.log('Loading and initializing SQLite3 module...');
	// const sqlite3 = await sqlite3InitModule({
	// 	print: console.log,
	// 	printErr: console.error,
	// })

	// console.log('Running SQLite3 version', sqlite3.version.libVersion);
	// const db = new sqlite3.oo1.OpfsDb('/mydb.sqlite3');

	// return { db, sqlite3 };
}


sw.addEventListener('install', async (event) => {
	console.log("installed", event);

	console.log("initiate sqlite3")
	const sqlite3InitializationPromise = await initializeSqlite();
	// const { sqlite3, db } = sqlite3InitializationPromise;

	// const tableNames = new Set<string>();
	// db.exec({
	// 	sql: `
    //         SELECT name 
    //         FROM sqlite_master 
    //         WHERE type='table'
    //     `,
	// 	callback: ([name]: [string]) => {
	// 		tableNames.add(name);
	// 	}
	// });

	// console.log(tableNames)
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
