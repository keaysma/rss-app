import { demo, devNukeDb, initializeSqlite, listFeedConfigs, insertFeedConfig, prepareDbTables, updateFeedData, selectFeedConfigFull, deleteFeedConfig, updateFeedConfig } from "./sqlite3";
import type { MessagePayload, MessageResponse, Sqlite3DatabaseHandle } from "./types";

async function handleMessage(db: Sqlite3DatabaseHandle, event: MessageEvent<MessagePayload>): Promise<MessageResponse> {
    switch (event.data.message) {
        case "ping": {
            return { message: "pong" };
        }
        case "init": {
            return { message: "initialized" };
        }
        case "upgrade": {
            console.log('Upgrade message received');
            prepareDbTables(db);
            return { message: "upgraded" };
        }
        case "list-feed-configs": {
            console.log('List feed configs message received');
            const feedConfigs = listFeedConfigs(db);
            return { message: "feed-configs", feedConfigs };
        }
        case "insert-feed-config": {
            console.log('Insert feed config message received');
            const feedConfig = event.data.feedConfig;
            insertFeedConfig(db, feedConfig);

            const feedConfigs = listFeedConfigs(db);
            return { message: "feed-configs", feedConfigs };
        }
        case "update-feed-config": {
            console.log('Update feed config message received');
            const feedConfig = event.data.feedConfig;
            updateFeedConfig(db, feedConfig);

            const feedConfigs = listFeedConfigs(db);
            return { message: "feed-configs", feedConfigs };
        }
        case "delete-feed-config": {
            console.log('Delete feed config message received');
            const feedConfigId = event.data.feedConfigId;
            deleteFeedConfig(db, feedConfigId);

            const feedConfigs = listFeedConfigs(db);
            return { message: "feed-configs", feedConfigs };
        }
        case "get-feed-config-full": {
            console.log('Get feed config HTML message received');
            const feedConfigId = event.data.feedConfigId;
            const feedConfigFullResponse = selectFeedConfigFull(db, feedConfigId);
            return { message: "feed-config-full", data: feedConfigFullResponse };
        }
        case "update-feed-config-data": {
            console.log('Update feed data message received');
            const feedConfig = event.data.feedConfigData;
            updateFeedData(db, feedConfig);

            const feedConfigFullResponse = selectFeedConfigFull(db, feedConfig.id);
            return { message: "feed-config-full", data: feedConfigFullResponse };
        }
        case "demo": {
            console.log('Demo message received');
            demo(db);
            const feedConfigs = listFeedConfigs(db);

            return { message: "feed-configs", feedConfigs };
        }
        case "dev-nuke":
            console.log('Dev-nuke message received');
            devNukeDb(db);
        default:
            console.error('Unknown message', event.data);

        return { message: "pong" };
    }
}

async function initializeWorker() {
    const sqlite3InitializationPromise = initializeSqlite();
    addEventListener("message", async (event: MessageEvent<MessagePayload>) => {
        console.log('worker received message', event.data);

        await sqlite3InitializationPromise;
        const response = await handleMessage(db, event);
        postMessage(response);
    })
    const { sqlite3, db } = await sqlite3InitializationPromise;
};

initializeWorker();
console.log('worker loaded');
