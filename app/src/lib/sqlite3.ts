/// <reference types="../../env.d.ts" />

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { FeedConfigFormData, FeedConfigOpenEntrySetting, FeedConfigRow, FeedEntryMetadata, ListFeedConfigResponse, Sqlite3DatabaseHandle, Sqlite3Hanlde, UpdateFeedConfigData } from './types';
import { DEFAULT_FEED_CONFIG, NEW_FEED_CONFIG } from './consts';

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

    makeMigration(
        "feed_config_open_entry_setting",
        () => {
            db.exec(`
                ALTER TABLE feed_configs
                ADD COLUMN open_entry_setting TEXT    
            `)

            db.exec({
                sql: `
                    UPDATE feed_configs
                    SET open_entry_setting = ?
                `,
                bind: [
                    NEW_FEED_CONFIG.open_entry_setting
                ]
            })
        }
    );

    makeMigration(
        "feed_entry_metadata",
        () => {
            db.exec(`
                CREATE TABLE feed_entry_metadata (
                    feed_id INTEGER,
                    entry_id TEXT,
                    is_marked_read INTEGER,
                    PRIMARY KEY (feed_id, entry_id)
                )
            `)
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
                open_entry_setting,
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
            open_entry_setting,
            last_updated,
            last_checked,
            etag
        ]: [
                number, // id
                string, // feed_type
                string, // url
                string, // proxy
                string, // title
                string, // description
                string, // scan_interval
                FeedConfigOpenEntrySetting, // open_entry_setting
                string, // last_updated
                string, // last_checked
                string  // etag
            ]) => {
            feedConfigs.push({
                id,
                feed_type,
                url,
                proxy,
                title,
                description,
                scan_interval,
                open_entry_setting,
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
        open_entry_setting,
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
                open_entry_setting,
                last_updated,
                last_checked,
                etag,
                html
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        bind: [
            feed_type,
            url,
            proxy,
            title,
            description,
            scan_interval,
            open_entry_setting,
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
        open_entry_setting,
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
                scan_interval = ?,
                open_entry_setting = ?
            WHERE id = ?
            RETURNING title`,
        bind: [
            feed_type,
            url,
            proxy,
            title,
            description,
            scan_interval,
            open_entry_setting,
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

export const selectFeedConfigFull = (db: Sqlite3DatabaseHandle, feedConfigId: number): FeedConfigRow => {
    let feedConfig = {
        ...DEFAULT_FEED_CONFIG
    };

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
                open_entry_setting,
                last_updated, 
                last_checked, 
                etag,
                html
            FROM feed_configs
            WHERE id = ?
        `,
        bind: [feedConfigId],
        callback: (
            [
                id,
                feed_type,
                url,
                proxy,
                title,
                description,
                scan_interval,
                open_entry_setting,
                last_updated,
                last_checked,
                etag,
                html
            ]: [
                    number, // id
                    string, // feed_type
                    string, // url
                    string, // proxy
                    string, // title
                    string, // description
                    string, // scan_interval
                    FeedConfigOpenEntrySetting, // open_entry_setting
                    string, // last_updated
                    string, // last_checked
                    string, // etag
                    string // html
                ]
        ) => {
            feedConfig = {
                id,
                feed_type,
                url,
                proxy,
                title,
                description,
                scan_interval,
                open_entry_setting,
                last_updated,
                last_checked,
                etag,
                html,
            };
        }
    });

    return feedConfig;
}

export const listFeedEntriesMetadata = (db: Sqlite3DatabaseHandle, feedConfigId: number): FeedEntryMetadata[] => {
    const feedEntriesMetadata: FeedEntryMetadata[] = [];
    db.exec({
        sql: `
            SELECT 
                entry_id, 
                is_marked_read
            FROM feed_entry_metadata
            WHERE feed_id = ?   
        `,
        bind: [feedConfigId],
        callback: ([
            entryId,
            isMarkedReadRaw,
        ]: [
                string, // entry_id
                number, // is_read
            ]) => {
            feedEntriesMetadata.push({
                entryId,
                isMarkedRead: Boolean(isMarkedReadRaw),
            });
        }
    });

    return feedEntriesMetadata;
}

export const upsertFeedEntryMetadata = (db: Sqlite3DatabaseHandle, feedConfigId: number, entryMetadata: FeedEntryMetadata) => {
    console.log("Updating a row in 'feed_entry_metadata' table...");

    const {
        entryId,
        isMarkedRead,
    } = entryMetadata;

    const isMarkedReadInt = Number(isMarkedRead);

    db.exec({
        sql: `
            INSERT INTO feed_entry_metadata (
                feed_id, 
                entry_id, 
                is_marked_read
            ) 
            VALUES (?, ?, ?) 
            ON CONFLICT (feed_id, entry_id) 
            DO UPDATE SET is_marked_read=?;
        `,
        bind: [
            feedConfigId,
            entryId,
            isMarkedReadInt,
            isMarkedReadInt,
        ],
    });
}

export const bulkUpsertFeedEntryMarkAsRead = (db: Sqlite3DatabaseHandle, feedConfigId: number, entryIds: string[]) => {
    console.log("Updating many rows in 'feed_entry_metadata' table, is_marked_read...");

    let statement = db.prepare(`
        INSERT INTO feed_entry_metadata (
            feed_id, 
            entry_id, 
            is_marked_read
        ) 
        VALUES (?, ?, ?)
        ON CONFLICT (feed_id, entry_id) 
        DO UPDATE SET is_marked_read=1;    
    `);

    entryIds.forEach(
        (entryId) => statement.bind([feedConfigId, entryId, 1]).stepReset()
    )

    statement.finalize();
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
