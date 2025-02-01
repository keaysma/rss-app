import type { ListFeedConfigResponse, MessagePayload } from "./types";

export const getFetchURL = ({ url, proxy, baseURL }: {
    baseURL?: string;
    url: string;
    proxy?: string;
}): string => {
    let targetUrl = url;

    if (baseURL && !url.match(/^(?:[a-z]+:)?\/\//i)) {
        const baseOrigin = new URL(baseURL).origin;
        targetUrl = `${baseOrigin}${url}`;
        console.debug('rewriting URL', url, '=>', targetUrl);
    }

    if (proxy === "cors-relay") {
        // Test if url is relative
        return `/cors-buster?page=${encodeURIComponent(targetUrl)}`;
    }

    return targetUrl;
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

        // Fallback to pubDate:
        // Try to find the most recent pubDate
        const pubDates = Array.from(doc.querySelectorAll("pubDate"));
        if (pubDates.length > 0) {
            const dates = pubDates.map((pubDate) => {
                const text = pubDate.textContent;
                if (text) {
                    return new Date(text).getTime();
                }
                return 0;
            }).filter((time) => time > 0);

            if (dates.length > 0) {
                return new Date(Math.max(...dates));
            }
        }
    }

    if (feedConfig.feed_type === "atom") {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "application/xml");
        const updated = doc.querySelector("updated");
        if (updated) {
            const text = updated.textContent;
            if (text) {
                return new Date(text);
            }
        }

        // Fallback to entry updated:
        const updateds = Array.from(doc.querySelectorAll("entry updated"));
        if (updateds.length > 0) {
            const dates = updateds.map((updated) => {
                const text = updated.textContent;
                if (text) {
                    return new Date(text).getTime();
                }
                return 0;
            }).filter((time) => time > 0);

            if (dates.length > 0) {
                return new Date(Math.max(...dates));
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

export const rewriteDocumentURLs = (feedConfig: ListFeedConfigResponse[number], doc: Document) => {
    console.debug('rewriting document URLs', feedConfig.url);

    // Pass all links through the proxy
    // doc.querySelectorAll('a').forEach((link) => {
    //     const href = link.getAttribute('href');
    //     if (href) {
    //         link.href = getFetchURL({ baseURL: feedConfig.url, url: href, proxy: feedConfig.proxy });
    //     }
    // });

    // Pass all images through the proxy
    doc.querySelectorAll('img').forEach((image) => {
        const src = image.getAttribute('src');
        if (src) {
            image.src = getFetchURL({ baseURL: feedConfig.url, url: src, proxy: feedConfig.proxy });
        }

        const srcset = image.getAttribute('srcset');
        if (srcset) {
            image.srcset = '';
        }
    });

    doc.querySelectorAll('source').forEach((sourceEl) => {
        const src = sourceEl.getAttribute('src');
        if (src) {
            sourceEl.src = getFetchURL({ baseURL: feedConfig.url, url: src, proxy: feedConfig.proxy });
        }

        const srcset = sourceEl.getAttribute('srcset');
        if (srcset) {
            sourceEl.srcset = '';
        }
    });

    doc.querySelectorAll('video').forEach((video) => {
        const src = video.getAttribute('src');
        if (src) {
            video.src = getFetchURL({ baseURL: feedConfig.url, url: src, proxy: feedConfig.proxy });
        }

        const poster = video.getAttribute('poster');
        if (poster) {
            video.poster = getFetchURL({ baseURL: feedConfig.url, url: poster, proxy: feedConfig.proxy });
        }
    });
}
