/// <reference types="@sqlite.org/sqlite-wasm" />
/// <reference types="../../env.d.ts" />

// import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { sqlite3Worker1Promiser } from '@sqlite.org/sqlite-wasm';

/*
export const initializeSqlite = async () => {
    const sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
    });

    return sqlite3;
}
*/

export const initializeSqlite = async () => {
    try {
        console.log('Loading and initializing SQLite3 module...');

        const promiser = await new Promise<any>((resolve) => {
            const _promiser = sqlite3Worker1Promiser({
                onready: () => resolve(_promiser),
            });
        });

        console.log('Done initializing. Running demo...');

        const configResponse = await promiser('config-get', {});
        console.log('Running SQLite3 version', configResponse.result.version.libVersion);

        return promiser
    } catch (err) {
        if (!(err instanceof Error)) {
            err = new Error(err.result.message);
        }
        console.error(err.name, err.message);
    }
};

export const openDbFile = async (promiser: any) => {
    const openResponse = await promiser('open', {
        filename: 'file:mydb.sqlite3?vfs=opfs',
    });
    console.log(
        'OPFS is available, created persisted database at',
        openResponse.result.filename.replace(/^file:(.*?)\?vfs=opfs$/, '$1'),
    );
}

export const fullInit = async () => {
    const handle = await initializeSqlite();
    console.log(handle);

    await openDbFile(handle);
}

export const initializeTestDb = async (sqlite3: any) => {
    console.log('Running SQLite3 version', sqlite3.version.libVersion);
    const db = new sqlite3.oo1.DB("/test.sqlite3", "ct");

    db.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT);');
    db.exec('INSERT INTO test (name) VALUES ("Alice");');
    db.exec('INSERT INTO test (name) VALUES ("Bob");');

    return db;
}
