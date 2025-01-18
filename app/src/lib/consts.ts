import type { FeedConfigFormData, FeedConfigRow } from "./types";

export const NEW_FEED_CONFIG: FeedConfigFormData = {
    id: -1,
    url: "",
    proxy: "",
    title: "",
    description: "",
    scan_interval: "",
    feed_type: "",
};

export const DEFAULT_FEED_CONFIG: FeedConfigRow = {
    id: -1,
    url: "",
    proxy: "",
    title: "",
    description: "",
    scan_interval: "",
    feed_type: "",
    last_checked: "",
    last_updated: "",
    html: "",
    etag: "",
};
