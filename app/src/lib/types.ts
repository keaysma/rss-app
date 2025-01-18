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

export type MessagePayload = GeneralMessagePayload | MessageInsertFeedConfig | MessageUpdateFeedConfig | MessageUpdateFeedData | MessageGetFeedConfigFull | MessageDeleteFeedConfig;

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

export type MessageResponse = MessageResponsePong | MessageResponseInitialized | MessageResponseUpgraded | MessageResponseFeedConfigs | MessageResponseFeedConfigFull;

export interface WorkerInterface extends Worker {
    postMessage: (message: MessagePayload) => void;
}

export interface WorkerContextState {
    callback: (event: MessageEvent<MessageResponse>) => void;
    ready: boolean;
}

export interface Sqlite3DatabaseHandle {
    filename: string;
    exec: (sql: string | { sql: string; bind?: any[]; callback?: (row: any) => void }) => void;
}

export interface Sqlite3Hanlde {
    version: {
        libVersion: string;
    };
    oo1: {
        OpfsDb: any;
    };
}

export interface FeedConfigRow {
    id: number;
    feed_type: string;
    url: string;
    proxy: string;
    title: string;
    description: string;
    scan_interval: string;
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
}

export interface UpdateFeedConfigData {
    id: number;
    last_updated: string;
    last_checked: string;
    etag: string;
    html: string;
}
