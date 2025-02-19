export interface MessagePayloadBase {
    message: string;
}

export interface GeneralMessagePayload extends MessagePayloadBase {
    message: "ping" | "init" | "upgrade" | "list-feed-configs" | "demo" | "dev-nuke"
}

export interface MessageInsertFeedConfig extends MessagePayloadBase {
    message: "insert-feed-config";
    feedConfig: FeedConfigFormData;
}

export interface MessageUpdateFeedConfig extends MessagePayloadBase {
    message: "update-feed-config";
    feedConfig: FeedConfigFormData;
}

export interface MessageGetFeedConfigFull extends MessagePayloadBase {
    message: "get-feed-config-full";
    feedConfigId: number;
}

export interface MessageUpdateFeedData extends MessagePayloadBase {
    message: "update-feed-config-data";
    feedConfigData: UpdateFeedConfigData;
}

export interface MessageDeleteFeedConfig extends MessagePayloadBase {
    message: "delete-feed-config";
    feedConfigId: number;
}

export interface MessageListFeedEntryMetadata extends MessagePayloadBase {
    message: "list-feed-entries-metadata";
    feedConfigId: number;
}

export interface UpdateFeedEntryMetadata extends MessagePayloadBase {
    message: "update-feed-entry-metadata";
    feedConfigId: number;
    entryMetadata: FeedEntryMetadata;
}

export interface BulkUpdateFeedEntryMarkRead extends MessagePayloadBase {
    message: "bulk-update-entries-mark-read";
    feedConfigId: number;
    entryIds: string[];
}

export type MessagePayload = GeneralMessagePayload | MessageInsertFeedConfig | MessageUpdateFeedConfig | MessageUpdateFeedData | MessageGetFeedConfigFull | MessageDeleteFeedConfig | MessageListFeedEntryMetadata | UpdateFeedEntryMetadata | BulkUpdateFeedEntryMarkRead;

export interface MessageResponseBase {
    message: string;
}

export interface MessageResponsePong extends MessageResponseBase {
    message: "pong";
}

export interface MessageResponseInitialized extends MessageResponseBase {
    message: "initialized";
}

export interface MessageResponseUpgraded extends MessageResponseBase {
    message: "upgraded";
}

export interface MessageResponseFeedConfigs extends MessageResponseBase {
    message: "feed-configs";
    feedConfigs: ListFeedConfigResponse;
}

export interface MessageResponseFeedConfigFull extends MessageResponseBase {
    message: "feed-config-full";
    data: FeedConfigRow;
}

export interface MessageRespondFeedEntryMetadataList extends MessageResponseBase {
    message: "feed-entry-metadata-list";
    feedConfigId: number;
    entriesMetadata: FeedEntryMetadata[];
}

export type MessageResponse = MessageResponsePong | MessageResponseInitialized | MessageResponseUpgraded | MessageResponseFeedConfigs | MessageResponseFeedConfigFull | MessageRespondFeedEntryMetadataList;

export interface WorkerInterface extends Worker {
    postMessage: (message: MessagePayload) => void;
}

export interface WorkerContextState {
    callback: (event: MessageEvent<MessageResponse>) => void;
    ready: boolean;
}

export interface Sqlite3DatabasePreparedStatement {
    bind: (args: any[]) => Sqlite3DatabasePreparedStatement;
    step: () => Sqlite3DatabasePreparedStatement;
    stepReset: () => Sqlite3DatabasePreparedStatement;
    finalize: () => void;
}

export interface Sqlite3DatabaseHandle {
    filename: string;
    exec: (sql: string | { sql: string; bind?: any[]; callback?: (row: any) => void }) => void;
    prepare: (sql: string | string[]) => Sqlite3DatabasePreparedStatement;
}

export interface Sqlite3Hanlde {
    version: {
        libVersion: string;
    };
    oo1: {
        OpfsDb: any;
    };
}

export type FeedConfigOpenEntrySetting = 'new-tab' | 'in-app';

export interface FeedConfigRow {
    id: number;
    feed_type: string;
    url: string;
    proxy: string;
    title: string;
    description: string;
    scan_interval: string;
    open_entry_setting: FeedConfigOpenEntrySetting;
    last_updated: string;
    last_checked: string;
    etag: string;
    html: string;
}

export type ListFeedConfigResponse = Omit<FeedConfigRow, "html">[];

export interface FeedConfigFormData {
    id: number;
    feed_type: string;
    url: string;
    proxy: string;
    title: string;
    description: string;
    scan_interval: string;
    open_entry_setting: FeedConfigOpenEntrySetting;
}

export interface UpdateFeedConfigData {
    id: number;
    last_updated: string;
    last_checked: string;
    etag: string;
    html: string;
}

export interface FeedEntryMetadata {
    entryId: string;
    isMarkedRead?: boolean;
}
