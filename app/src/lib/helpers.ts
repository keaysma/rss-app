import type { ListFeedConfigResponse } from "./types";

export const getFetchURL = ({ url, proxy }: {
    url: string;
    proxy?: string;
}): string => {
    if (proxy === "cors-relay") {
        return `/cors-buster?page=${encodeURIComponent(url)}`;
    }

    return url;
}

// Turn a scan interval string into a number of milliseconds.
export const parseScanInterval = (scanInterval: string): number => {
    const match = scanInterval.match(/^(\d+)([mhdw])$/);
    if (!match) {
        throw new Error(`Invalid scan interval: ${scanInterval}`);
    }

    const [, value, unit] = match;
    switch (unit) {
        case "m":
            return parseInt(value) * 60 * 1000;
        case "h":
            return parseInt(value) * 60 * 60 * 1000;
        case "d":
            return parseInt(value) * 24 * 60 * 60 * 1000;
        case "w":
            return parseInt(value) * 7 * 24 * 60 * 60 * 1000;
        default:
            throw new Error(`Invalid scan interval: ${scanInterval}`);
    }
}

export const getLastUpdated = (feedConfig: ListFeedConfigResponse[number], response: Response, text: string): Date => {
    if (response.headers.get("etag") === feedConfig.etag) {
        return new Date(feedConfig.last_updated);
    }

    if (feedConfig.feed_type === "rss") {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "application/xml");
        const lastBuildDate = doc.querySelector("lastBuildDate");
        if (lastBuildDate) {
            const text = lastBuildDate.textContent;
            if (text) {
                return new Date(text);
            }
        }
    }

    return new Date();
};

export const formatDate = (serializedDate: string): string => {
    const date = new Date(serializedDate);
    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
        }
    );
}
