import { getFetchURL } from "./helpers";
import type { FeedConfigFormData } from "./types";

export const fetchFeedDetails = async (feed: FeedConfigFormData) => {
    const { url, proxy, title, description } = feed;

    try {
        const fetchURL = getFetchURL({
            url,
            proxy
        });
        const response = await fetch(fetchURL);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/xml');
        if (doc.querySelector('parsererror')) {
            throw new Error('Invalid XML');
        }

        const docTitle = doc.querySelector('title')?.textContent;
        const docDescription = doc.querySelector('description')?.textContent;
        const docFeedType = doc.querySelector('rss')
            ? 'rss'
            : doc.querySelector('feed')
                ? 'atom'
                : 'unknown';

        console.debug({ docTitle, docDescription, docFeedType });

        return {
            title: docTitle || title,
            description: docDescription || description,
            feed_type: docFeedType
        }
    } catch (error) {
        console.error('failed', error);

        if (error instanceof Error) {
            const errorMessage = error.message;

            console.log({ error });

            if (error.message.includes('NetworkError')) {
                throw errorMessage + 'Try using a CORS proxy (Advanced)';
            }

            throw errorMessage;
        }

        throw error;
    }
};