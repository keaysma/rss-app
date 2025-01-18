import type { FeedConfigFormData, FeedConfigOpenEntrySetting, FeedConfigRow } from "./types";

export const NEW_FEED_CONFIG: FeedConfigFormData = {
    id: -1,
    url: "",
    proxy: "",
    title: "",
    description: "",
    scan_interval: "",
    open_entry_setting: "in-app",
    feed_type: "",
};

export const DEFAULT_FEED_CONFIG: FeedConfigRow = {
    id: -1,
    url: "",
    proxy: "",
    title: "",
    description: "",
    scan_interval: "",
    open_entry_setting: "in-app",
    feed_type: "",
    last_checked: "",
    last_updated: "",
    html: "",
    etag: "",
};

export const OPEN_ENTRY_SETTING_OPTIONS_MAP: Record<FeedConfigOpenEntrySetting, string> = {
    "in-app": "In App",
    "new-tab": "New Tab",
};
