/// <reference types="../../env.d.ts" />

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { FeedConfigFormData, FeedConfigHTMLResponse, ListFeedConfigResponse, Sqlite3DatabaseHandle, Sqlite3Hanlde, UpdateFeedConfigData } from './types';

export const demoDummy = (db: Sqlite3DatabaseHandle) => {
    console.log("Created database at", db.filename);

    // List all tables in the database
    const tableName = "test";
    const result: [string][] = [];
    db.exec({
        sql: `SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}';`,
        callback: (row: [string]) => {
            result.push(row);
        }
    });

    if (result.length === 0) {
        console.log(`Table '${tableName}' does not exist`);
        db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);");
    } else {
        console.log(`Table 'test' schema: ${result?.[0]?.[0]}`);

        console.log("Inserting a row into 'test' table...");
        const id = Number(Date.now());
        const name = [...Array(3)].map(() => Number(Math.random()).toString(16).split(".")[1]).join("-");
        db.exec({
            sql: "INSERT INTO test (id, name) VALUES (?, ?) RETURNING name;",
            bind: [id, name],
            callback: (row: [string]) => {
                console.log("Inserted row with name:", row[0]);
            }
        });

        const rows: [string, string][] = [];
        db.exec({
            sql: "SELECT id, name FROM test;",
            callback: (row: [string, string]) => {
                rows.push(row);
            }
        });

        console.log("Rows in 'test' table:");
        console.table(rows);

        console.log("Deleting row from 'test' table...");
        db.exec({
            sql: "DELETE FROM test WHERE id = ?;",
            bind: [id],
        });

        const rowsAfterDelete: [string, string][] = [];
        db.exec({
            sql: "SELECT id, name FROM test;",
            callback: (row: [string, string]) => {
                rowsAfterDelete.push(row);
            }
        });

        console.log("Rows in 'test' table after delete:");
        console.table(rowsAfterDelete);
    }
}

export const demo = (db: Sqlite3DatabaseHandle) => {
    console.log("Inserting a row into 'feed_config' table...");

    const feed_type = "rss";
    const url = "https://example.com/rss";
    const title = "Example RSS Feed";
    const description = "An example RSS feed";
    const scan_interval = "1h";
    const last_updated = new Date().toISOString();
    const last_checked = new Date().toISOString();
    const etag = "12345";

    db.exec({
        sql: `
            INSERT INTO feed_configs (
                feed_type,
                url,
                title,
                description,
                scan_interval,
                last_updated,
                last_checked,
                etag
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        bind: [
            feed_type,
            url,
            title,
            description,
            scan_interval,
            last_updated,
            last_checked,
            etag
        ],
        callback: ([id]: [string]) => {
            console.log("Inserted row with name:", id);
        }
    });
}

const getAllTableNames = (db: Sqlite3DatabaseHandle): Set<string> => {
    const tableNames = new Set<string>();
    db.exec({
        sql: `
            SELECT name 
            FROM sqlite_master 
            WHERE type='table'
        `,
        callback: ([name]: [string]) => {
            tableNames.add(name);
        }
    });

    return tableNames;
};

export const devNukeDb = (db: Sqlite3DatabaseHandle) => {
    const tableNames = getAllTableNames(db);

    console.debug("Tables in the database:", tableNames);

    for (const tableName of tableNames) {
        db.exec(`DROP TABLE ${tableName}`);
    }

    console.log("All tables dropped");
}

export const prepareDbTables = (db: Sqlite3DatabaseHandle) => {
    const tableNames = getAllTableNames(db);

    console.debug("Tables in the database:", tableNames);

    if (!tableNames.has("schema_migrations")) {
        db.exec(`
            CREATE TABLE schema_migrations (
                version string PRIMARY KEY, 
                applied_at TEXT
            )
        `);
    }

    const migrations: Record<string, Date> = {};
    db.exec({
        sql: `
            SELECT version, applied_at 
            FROM schema_migrations
        `,
        callback: ([version, applied_at]: [number, string]) => {
            migrations[version] = new Date(applied_at);
        }
    });
    console.table(Object.entries(migrations));

    const makeMigration = (version: string, migration: () => void) => {
        if (migrations[version]) {
            console.log(`Migration ${version} already applied at ${migrations[version]}`);
            return;
        }

        console.log(`Applying migration ${version}...`);
        migration();
        db.exec({
            sql: `
                INSERT INTO schema_migrations (version, applied_at) 
                VALUES (?, ?)
            `,
            bind: [version, new Date().toISOString()],
        });
    }

    makeMigration(
        "foobar",
        () => {
            db.exec(`
                CREATE TABLE foobar (
                    id INTEGER PRIMARY KEY, 
                    name TEXT
                )
            `);
        }
    );

    makeMigration(
        "feed_configs",
        () => {
            db.exec(`
                CREATE TABLE feed_configs (
                    id INTEGER PRIMARY KEY, 
                    feed_type TEXT,
                    url TEXT,
                    proxy TEXT,
                    title TEXT,
                    description TEXT,
                    scan_interval TEXT,
                    last_updated TEXT,
                    last_checked TEXT,
                    etag TEXT,
                    html TEXT
                )
            `);
        }
    )
}

export const listFeedConfigs = (db: Sqlite3DatabaseHandle): ListFeedConfigResponse => {
    const feedConfigs: ListFeedConfigResponse = [];
    db.exec({
        sql: `
            SELECT 
                id, 
                feed_type, 
                url, 
                proxy,
                title, 
                description, 
                scan_interval, 
                last_updated, 
                last_checked, 
                etag
            FROM feed_configs`,
        callback: ([
            id,
            feed_type,
            url,
            proxy,
            title,
            description,
            scan_interval,
            last_updated,
            last_checked,
            etag
        ]: [number, string, string, string, string, string, string, string, string, string]) => {
            feedConfigs.push({
                id,
                feed_type,
                url,
                proxy,
                title,
                description,
                scan_interval,
                last_updated,
                last_checked,
                etag,
            });
        }
    });

    return feedConfigs;
}

export const insertFeedConfig = (db: Sqlite3DatabaseHandle, feedConfig: FeedConfigFormData) => {
    console.log("Inserting a row into 'feed_configs' table...");

    const {
        feed_type,
        url,
        proxy,
        title,
        description,
        scan_interval,
    } = feedConfig;

    db.exec({
        sql: `
            INSERT INTO feed_configs (
                feed_type,
                url,
                proxy,
                title,
                description,
                scan_interval,
                last_updated,
                last_checked,
                etag,
                html
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        bind: [
            feed_type,
            url,
            proxy,
            title,
            description,
            scan_interval,
            "",
            "",
            "",
            "",
        ],
        callback: ([id]: [string]) => {
            console.log("Inserted row with id:", id);
        }
    });
}

export const updateFeedConfig = (db: Sqlite3DatabaseHandle, feedConfig: FeedConfigFormData) => {
    console.log("Update a row in 'feed_configs' table...", feedConfig.id, feedConfig);

    const {
        id,
        feed_type,
        url,
        proxy,
        title,
        description,
        scan_interval,
    } = feedConfig;

    db.exec({
        sql: `
            UPDATE feed_configs
            SET
                feed_type = ?,
                url = ?,
                proxy = ?,
                title = ?,
                description = ?,
                scan_interval = ?
            WHERE id = ?
            RETURNING title`,
        bind: [
            feed_type,
            url,
            proxy,
            title,
            description,
            scan_interval,
            id,
        ],
        callback: ([title]: [string]) => {
            console.log("Updated row with title:", title);
        }
    });
}

export const updateFeedData = (db: Sqlite3DatabaseHandle, feedConfig: UpdateFeedConfigData) => {
    console.log("Updating a row in 'feed_configs' table...");

    const {
        id,
        last_updated,
        last_checked,
        etag,
        html,
    } = feedConfig;

    db.exec({
        sql: `
            UPDATE feed_configs
            SET
                last_updated = ?,
                last_checked = ?,
                etag = ?,
                html = ?
            WHERE id = ?`,
        bind: [
            last_updated,
            last_checked,
            etag,
            html,
            id,
        ],
    });
}

export const deleteFeedConfig = (db: Sqlite3DatabaseHandle, feedConfigId: number) => {
    console.log("Deleting a row from 'feed_config' table...");

    db.exec({
        sql: `
            DELETE FROM feed_configs
            WHERE id = ?
        `,
        bind: [feedConfigId],
    });
}

export const selectFeedConfigHTML = (db: Sqlite3DatabaseHandle, feedConfigId: number): FeedConfigHTMLResponse => {
    let html = "";
    db.exec({
        sql: `
            SELECT html
            FROM feed_configs
            WHERE id = ?
        `,
        bind: [feedConfigId],
        callback: ([htmlData]: [string]) => {
            html = htmlData;
        }
    });

    return { id: feedConfigId, html };
}

export const initializeSqlite = async () => {
    console.log('Loading and initializing SQLite3 module...');
    const sqlite3: Sqlite3Hanlde = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
    })

    console.log('Running SQLite3 version', sqlite3.version.libVersion);
    const db: Sqlite3DatabaseHandle = new sqlite3.oo1.OpfsDb('/mydb.sqlite3');

    return { db, sqlite3 };
}
