import type { ListFeedConfigResponse, MessagePayload } from "./types";

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

export const refreshFeed = async (feedConfig: ListFeedConfigResponse[number], onPost: (args0: MessagePayload) => void): Promise<string> => {
    const headers: HeadersInit = {};
    if (feedConfig.etag) {
        headers['If-None-Match'] = feedConfig.etag;
    }

    const fetchURL = getFetchURL({
        url: feedConfig.url,
        proxy: feedConfig.proxy
    });

    const res = await fetch(fetchURL, {
        headers
    });
    if (res.status === 304) {
        console.debug('feed not modified', feedConfig.url);

        // Potentially could end up with an blank article
        return '';
    }

    const last_checked = new Date().toISOString();

    const etag = res.headers.get('etag') || '';
    const html = await res.text();
    const last_updated = getLastUpdated(feedConfig, res, html).toISOString();
    onPost({
        message: 'update-feed-config-data',
        feedConfigData: {
            id: feedConfig.id,
            last_checked,
            last_updated,
            html,
            etag
        }
    });

    return html;
};
