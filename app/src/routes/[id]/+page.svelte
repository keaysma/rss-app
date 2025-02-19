<script lang="ts">
	import { formatDate, getFetchURL, refreshFeed, rewriteDocumentURLs } from '$lib/helpers';
	import type {
		FeedConfigRow,
		FeedEntryMetadata,
		MessagePayload,
		MessageResponse,
		WorkerContextState
	} from '$lib/types';
	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { isolateClick } from '$lib/utils';

	type EntryMDMap = Record<FeedEntryMetadata['entryId'], FeedEntryMetadata>;

	const feedConfigId = Number(page.params.id);

	let selectedFeedConfig = $state<FeedConfigRow>();
	let feedEntryMetadata = $state<EntryMDMap>({});

	const postMessage = getContext<(args: MessagePayload) => void>('postMessage');
	const workerState = getContext<WorkerContextState>('onMessageConnector');

	workerState.callback = (event: MessageEvent<MessageResponse>) => {
		switch (event.data.message) {
			case 'feed-config-full': {
				console.debug('received feed-config-full', { ...event.data.data });
				if (event.data.data.id !== feedConfigId) {
					console.warn('ignore feed-config-full: id mismatch', feedConfigId, event.data.data.id);
					return;
				}

				selectedFeedConfig = event.data.data;
				break;
			}
			case 'feed-entry-metadata-list': {
				console.debug('received feed-entry-metadata-list');
				if (event.data.feedConfigId !== feedConfigId) {
					console.warn(
						'ignore feed-entry-metadata-list: id mismatch',
						feedConfigId,
						event.data.feedConfigId
					);
					return;
				}

				feedEntryMetadata = event.data.entriesMetadata.reduce<EntryMDMap>((acc, entry) => {
					acc[entry.entryId] = entry;
					return acc;
				}, {});
				break;
			}
			default:
				console.log('unknown message', event.data);
		}
	};

	$effect(() => {
		if (workerState.ready) {
			console.log('get-feed-config-full', feedConfigId);
			postMessage({ message: 'list-feed-entries-metadata', feedConfigId });
			postMessage({ message: 'get-feed-config-full', feedConfigId });
		}
	});

	const handleEntryMarkRead = (entryId: string, isMarkedRead: boolean) => {
		const existingMetadataEntry = feedEntryMetadata[entryId];

		const entryMetadata = {
			...existingMetadataEntry,
			entryId,
			isMarkedRead
		} satisfies FeedEntryMetadata;

		postMessage({
			message: 'update-feed-entry-metadata',
			feedConfigId,
			entryMetadata
		});
	};

	const handleEntryClick = (entry: { guid: string; link: string }) => {
		const { guid, link } = entry;
		handleEntryMarkRead(guid, true);
		if (selectedFeedConfig?.open_entry_setting == 'in-app') {
			selectedFeedEntryLink = link;
		} else {
			window.open(link, '_blank');
		}
	};

	const handleEntryToggleMarkRead = (entryId: string) => {
		const existingMetadataEntry = feedEntryMetadata[entryId];
		handleEntryMarkRead(entryId, !(existingMetadataEntry?.isMarkedRead ?? false));
	};

	const handleMarkAllEntriesAsRead = () => {
		const entryIds = selectedFeedHTMLParsed.map(({ guid }) => guid)

		postMessage({
			message: 'bulk-update-entries-mark-read',
			feedConfigId,
			entryIds,
		})
	}

	let selectedFeedHTMLParsed = $derived.by(() => {
		if (!selectedFeedConfig || selectedFeedConfig.html === null || selectedFeedConfig.html === '') {
			return [];
		}

		const parser = new DOMParser();
		const doc = parser.parseFromString(selectedFeedConfig.html, 'text/html');
		const items = doc.querySelectorAll('item, entry');
		const parsedItems = Array.from(items).map((item) => {
			const guid =
				item.querySelector('guid')?.textContent || item.querySelector('id')?.textContent || '';
			const rawTitle = item.querySelector('title')?.textContent || '';
			const rawDescription =
				item.querySelector('description')?.textContent ||
				item.querySelector('content')?.textContent ||
				'';
			const enclosure = item.querySelector('enclosure')?.getAttribute('url') || '';
			const pubDate =
				item.querySelector('pubDate')?.textContent ||
				item.querySelector('published')?.textContent ||
				'';
			const updated = item.querySelector('updated')?.textContent || '';
			const content = item.querySelector('content')?.textContent || '';
			const summary = item.querySelector('summary')?.textContent || '';

			const titleDocument = parser.parseFromString(rawTitle, 'text/html');
			const title = titleDocument.body.innerHTML;

			const link =
				item.querySelector('link')?.href ||
				item.querySelector('link')?.textContent ||
				item.querySelector('link')?.nextSibling?.textContent ||
				guid;

			const descriptionDocument = parser.parseFromString(rawDescription, 'text/html');
			rewriteDocumentURLs(selectedFeedConfig!, descriptionDocument);

			const descriptionHtml = descriptionDocument.body.innerHTML;

			return {
				guid,
				title,
				link,
				descriptionHtml,
				enclosure,
				pubDate,
				updated,
				content,
				summary
			};
		});

		return parsedItems.toSorted(
			(a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
		);
	});
	let selectedFeedEntryLink: null | string = $state(null);
	let selectedFeedEntryHTML = $derived.by(async () => {
		if (selectedFeedEntryLink === null) {
			return '';
		}

		const fetchURL = getFetchURL({
			url: selectedFeedEntryLink,
			proxy: selectedFeedConfig?.proxy
		});
		const res = await fetch(fetchURL);
		const html = await res.text();

		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		console.debug('selectedFeedEntryHTML', { html, doc });
		rewriteDocumentURLs(selectedFeedConfig!, doc);

		return doc.documentElement.innerHTML;
	});

	const hanldeRefreshFeed = async () => {
		if (!selectedFeedConfig) {
			return;
		}

		await refreshFeed(selectedFeedConfig, postMessage);
	};
</script>

<header>
	{#if selectedFeedConfig}
		<h1>{selectedFeedConfig.title}</h1>
	{:else}
		<h1>Loading...</h1>
	{/if}
	<button onclick={() => goto(`/`)}> Close </button>
	<button onclick={hanldeRefreshFeed}> Refresh </button>
	<details class="dropdown">
		<!-- svelte-ignore a11y_no_redundant_roles -->
		<summary role="button">...</summary>
		<ul
			onclickcapture={(e) => {
				(e.currentTarget.parentElement as HTMLDetailsElement).open = false;
			}}
		>
			<li>
				<a href="##" onclick={() => handleMarkAllEntriesAsRead()}> Mark all as read</a>
			</li>
		</ul>
	</details>
</header>

<main
	class="grid entry-list"
	class:reading={selectedFeedConfig?.open_entry_setting == 'in-app' &&
		selectedFeedEntryLink !== null}
	class:full-size={selectedFeedConfig?.open_entry_setting == 'new-tab'}
>
	<table class="feed striped">
		<thead>
			<tr>
				<th></th>
				<th></th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#if selectedFeedConfig}
				{#each selectedFeedHTMLParsed as entry}
					<tr>
						<td class="mark-read-indicator">
							<button
								class="mark-read"
								class:is-read={feedEntryMetadata[entry.guid]?.isMarkedRead ?? false}
								aria-label="mark as read"
								onclick={isolateClick(() => handleEntryToggleMarkRead(entry.guid))}
							>
							</button>
						</td>
						<!-- TODO: Use link/anchor? -->
						<td
							class="entry"
							onclick={(event) => {
								// Allow anchor elements to be clicked, without opening the entry
								if (event.target instanceof HTMLAnchorElement) {
									return;
								}

								handleEntryClick(entry);
							}}
						>
							<hgroup>
								<h3>{entry.title}</h3>
								<small>{formatDate(entry.pubDate)}</small>
							</hgroup>
							<document class="description">
								{@html entry.descriptionHtml}
							</document>
						</td>
						<td class="actions">
							<details class="dropdown">
								<!-- svelte-ignore a11y_no_redundant_roles -->
								<summary role="button">...</summary>
								<ul
									dir="rtl"
									onclickcapture={(e) => {
										(e.currentTarget.parentElement as HTMLDetailsElement).open = false;
									}}
								>
									<li>
										<a href="##" onclick={() => handleEntryToggleMarkRead(entry.guid)}>
											Mark as Read
										</a>
									</li>
									<li>
										<a href="##">Save</a>
									</li>
									<li>
										<a href="##">Hide</a>
									</li>
								</ul>
							</details>
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
	<aside class="article-container page-container">
		<article>
			<button onclick={() => (selectedFeedEntryLink = null)} class="secondary">close</button>
			{#await selectedFeedEntryHTML}
				<p>Loading...</p>
			{:then selectedFeedEntryHTMLResolved}
				{@html selectedFeedEntryHTMLResolved}
			{:catch error}
				<p>Error: {error.message}</p>
			{/await}
		</article>
	</aside>
</main>

<style lang="scss">
	header {
		> button {
			display: inline-block;
		}
		> details {
			display: inline-block;
			width: 5em;
			margin-left: 0.5em;
		}
	}

	.entry-list {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-areas: 'entries article';

		&:not(.reading) {
			grid-template-areas: 'entries';
			grid-template-columns: 1fr;

			> aside {
				display: none;
			}
		}

		> table {
			grid-area: entries;

			.mark-read-indicator {
				vertical-align: top;
				padding-left: 0.75em;
				padding-right: 0;
				> button {
					width: 24px;
					height: 24px;

					border-radius: 4em;

					margin: 0;
					padding: 0;

					&.is-read {
						border-color: var(--pico-color-grey-500);
						background-color: var(--pico-color-grey-500);
					}
				}
			}

			.entry {
				> hgroup {
					cursor: pointer;
				}
				> .description {
					font-size: small;
				}
			}
		}

		> aside {
			grid-area: article;
			> article {
				> button {
					position: sticky;
					top: 0em;
					float: right;
				}

				position: sticky;
				top: 0;

				max-height: 100vh;
				overflow: scroll;
			}
		}

		@media only screen and (max-width: 768px) {
			&.reading {
				display: block;

				> table {
					display: none;
				}

				> aside {
					> article {
						position: fixed;
						top: 0; //-7em;
						left: 0;
						width: 100%;
					}
				}
			}

			&:not(.reading) {
				grid-template-columns: 1fr;
				grid-template-areas: 'entries';

				> aside {
					display: none;
				}
			}
		}
	}
</style>
