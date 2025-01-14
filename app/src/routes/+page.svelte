<script lang="ts">
	import ThemeSwitcher from '$lib/components/theme-switcher.svelte';
	import initWorker from '$lib/loadWorker';
	import type {
		FeedConfigFormData,
		ListFeedConfigResponse,
		MessageResponse,
		WorkerInterface
	} from '$lib/types';
	import { formatDate, getFetchURL, getLastUpdated, parseScanInterval } from '$lib/helpers';
	import { onDestroy, onMount } from 'svelte';
	import { fetchFeedDetails } from '$lib/requests';
	import { NEW_FEED_CONFIG } from '$lib/consts';

	let worker: WorkerInterface | null = $state(null);
	let feedConfigs: ListFeedConfigResponse = $state([]);
	let feedConfigsFetchLock: Record<number, boolean> = $state({});
	let feedScanInterval: number;
	onMount(async () => {
		worker = await initWorker(handleWorkerMessage);
		worker.postMessage({ message: 'upgrade' });
		(window as any).nukeDatabase = () => {
			if (worker !== null && confirm('Are you sure you want to')) {
				worker?.postMessage({ message: 'dev-nuke' });
			}
		};

		feedScanInterval = setInterval(scanFeeds, 60_000);
	});
	onDestroy(() => {
		clearInterval(feedScanInterval);
	});

	const handleWorkerMessage = (event: MessageEvent<MessageResponse>) => {
		console.log(event.data);
		switch (event.data.message) {
			case 'pong':
				console.log('pong');
				break;
			case 'upgraded':
				console.log('upgraded');
				worker?.postMessage({ message: 'list-feed-configs' });
				break;
			case 'feed-configs':
				feedConfigs = event.data.feedConfigs;

				if (feedConfigs.length === 0) {
					feedConfigForm = { ...NEW_FEED_CONFIG };
					selectedAction = 'new';
				} else {
					resetActionState();
					scanFeeds();
				}
				break;
			case 'feed-config-html':
				if (event.data.data.id !== selectedFeedConfig?.id) {
					console.warn(
						'selectedFeedConfig?.id !== event.data.data.id',
						selectedFeedConfig?.id,
						event.data.data.id
					);

					// maybe? how did we even get here, oy vey!
					// loadingFeedHTML = false;
					return;
				}

				if (event.data.data.html !== '') {
					loadingFeedHTML = false;
					selectedFeedHTML = event.data.data.html;
					return;
				}

				refreshFeed(selectedFeedConfig)
					.then((html) => {
						selectedFeedHTML = html;
					})
					.finally(() => {
						loadingFeedHTML = false;
					});
			default:
				console.log('unknown message', event.data);
		}
	};

	const refreshFeed = async (feedConfig: ListFeedConfigResponse[number]): Promise<string> => {
		try {
			feedConfigsFetchLock[feedConfig.id] = true;

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
			worker?.postMessage({
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
		} catch (error) {
			console.error('failed', error);
		} finally {
			feedConfigsFetchLock[feedConfig.id] = false;
		}

		return '';
	};

	const scanFeeds = async () => {
		if (worker === null) {
			return;
		}

		for (const feedConfig of feedConfigs) {
			if (feedConfigsFetchLock[feedConfig.id]) {
				continue;
			}

			const lastScan = new Date(feedConfig.last_checked);
			const scanInterval = parseScanInterval(feedConfig.scan_interval);
			const nextScan = new Date(Number(lastScan) + scanInterval);
			console.debug(feedConfig.id, feedConfig.url, { lastScan, scanInterval, nextScan });

			if (nextScan > new Date()) {
				continue;
			}

			console.debug('fetching', feedConfig.url);
			await refreshFeed(feedConfig);
		}
	};

	let urlFetchError = $state('');
	// let url = $state('');
	// let proxy = $state('');
	// let title = $state('');
	// let description = $state('');
	// let scan_interval = $state('30m');
	// let feed_type = $state('rss');

	let selectedAction: 'open' | 'details' | 'new' | 'edit' | 'delete' | null = $state(null);
	let feedConfigForm: FeedConfigFormData | null = $state(null);
	let selectedFeedConfig: ListFeedConfigResponse[number] | null = $state(null);
	const resetActionState = () => {
		selectedAction = null;
		feedConfigForm = null;
		selectedFeedConfig = null;
	};

	/*
	 null: no feed html fetched
	 "": feed html fetched but nothing to show
	 */
	let loadingFeedHTML = $state(false);
	let selectedFeedHTML: null | string = $state(null);
	let selectedFeedHTMLParsed = $derived.by(() => {
		if (selectedFeedHTML === null || selectedFeedHTML === '') {
			return [];
		}

		const parser = new DOMParser();
		const doc = parser.parseFromString(selectedFeedHTML, 'text/html');
		const items = doc.querySelectorAll('item, entry');
		const parsedItems = Array.from(items).map((item) => {
			const guid = item.querySelector('guid')?.textContent || '';
			const title = item.querySelector('title')?.textContent || '';
			const rawDescription = item.querySelector('description')?.textContent || '';
			const enclosure = item.querySelector('enclosure')?.getAttribute('url') || '';
			const pubDate = item.querySelector('pubDate')?.textContent || '';
			const updated = item.querySelector('updated')?.textContent || '';
			const content = item.querySelector('content')?.textContent || '';
			const summary = item.querySelector('summary')?.textContent || '';

			const link =
				item.querySelector('link')?.textContent ||
				item.querySelector('link')?.nextSibling?.textContent ||
				guid;
			const descriptionHtml = parser.parseFromString(rawDescription, 'text/html').body.innerHTML;

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

		return parsedItems;
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

		// Add <base href={selectedFeedEntryLink}/>
		const base = doc.createElement('base');
		base.href = selectedFeedEntryLink;
		doc.head.appendChild(base);

		// entire document to string
		return doc.documentElement.outerHTML;
	});

	// example: https://avi.im/blag/index.xml
	// example: https://hartenfeller.dev/rss.xml
	const getFeedDetails = async () => {
		if (!selectedFeedConfig) {
			return;
		}

		urlFetchError = '';
		fetchFeedDetails(selectedFeedConfig)
			.then(({ title, description, feed_type }) => {
				console.debug({ title, description, feed_type });
				selectedFeedConfig = {
					...selectedFeedConfig!,
					title,
					description,
					feed_type
				};
			})
			.catch((error) => {
				urlFetchError = error.message;
			});
	};

	const submitFeedConfigForm = (event: Event) => {
		event.preventDefault();
		event.stopPropagation();

		if (!feedConfigForm) {
			console.error('feedConfigForm is null');
			return;
		}

		console.debug('submitFeedConfigForm', { ...feedConfigForm });
		if (worker !== null) {
			worker.postMessage({
				message: feedConfigForm.id === -1 ? 'insert-feed-config' : 'update-feed-config',
				feedConfig: { ...feedConfigForm }
			});

			resetActionState();
		}
	};

	const deleteFeedConfig = (feedConfig: ListFeedConfigResponse[number]) => {
		if (worker !== null) {
			worker.postMessage({
				message: 'delete-feed-config',
				feedConfigId: feedConfig.id
			});
		}
	};

	const getFeedHTML = (feedConfig: ListFeedConfigResponse[number]) => {
		loadingFeedHTML = true;

		if (worker === null) {
			console.warn('worker is null, cannot fetch feed html from db');
			refreshFeed(feedConfig)
				.then((html) => {
					selectedFeedHTML = html;
				})
				.finally(() => {
					loadingFeedHTML = false;
				});
		}

		worker?.postMessage({
			message: 'get-feed-config-html',
			feedConfigId: feedConfig.id
		});
	};
</script>

<!-- WIP -->
<!-- <ThemeSwitcher /> -->

<!-- list of feed configs -->

{#if selectedFeedConfig !== null && selectedAction === 'open'}
	<header>
		<h1>{selectedFeedConfig.title}</h1>
		<button onclick={resetActionState}> Close </button>
		<button onclick={() => refreshFeed({ ...selectedFeedConfig!, etag: '' })}> Refresh </button>
	</header>

	<main class="grid entry-list" class:reading={selectedFeedEntryLink !== null}>
		<table class="feed striped">
			<thead>
				<tr>
					<th></th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#if loadingFeedHTML}
					<tr>
						<td>Loading...</td>
						<td></td>
					</tr>
				{:else}
					{#each selectedFeedHTMLParsed as entry}
						<tr>
							<!-- TODO: Use link? -->
							<td class="entry" onclick={() => (selectedFeedEntryLink = entry.link)}>
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
									<ul>
										<li>
											<a href="##">Mark as Read</a>
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
{:else}
	<header>
		<h1>Feeds</h1>
		<button
			disabled={worker === null}
			onclick={() => {
				selectedAction = 'new';
				feedConfigForm = { ...NEW_FEED_CONFIG };
			}}
			class="new-feed"
		>
			New
		</button>
	</header>
	<main>
		<table class="feed-list striped">
			<thead>
				<tr>
					<th> Title </th>
					<th> Last Updated </th>
					<th> Actions </th>
				</tr>
			</thead>
			<tbody>
				{#each feedConfigs as feedConfig}
					<tr
						class="feed-entry"
						onclick={() => {
							selectedAction = 'open';
							selectedFeedConfig = feedConfig;
							getFeedHTML(feedConfig);
						}}
					>
						<td>
							{feedConfig.title}
						</td>
						<td> {formatDate(feedConfig.last_updated)} </td>
						<td class="actions" onclick={(e) => e.stopPropagation()}>
							<details class="dropdown">
								<!-- svelte-ignore a11y_no_redundant_roles -->
								<summary role="button">...</summary>
								<ul>
									<li>
										<a href="##" onclick={() => refreshFeed({ ...feedConfig, etag: '' })}>Refresh</a
										>
									</li>
									<li>
										<a
											href="##"
											onclick={() => {
												selectedAction = 'details';
												selectedFeedConfig = feedConfig;
											}}>Details</a
										>
									</li>
									<li>
										<a
											href="##"
											onclick={() => {
												selectedAction = 'edit';
												feedConfigForm = { ...feedConfig };
											}}>Edit</a
										>
									</li>
									<li>
										<a
											href="##"
											onclick={() => {
												selectedAction = 'delete';
												selectedFeedConfig = feedConfig;
											}}>Delete</a
										>
									</li>
								</ul>
							</details>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</main>
	<footer>
		<!-- <span>made by michael</span> -->
	</footer>
{/if}

<dialog open={selectedFeedConfig !== null && selectedAction === 'details'}>
	<article>
		<h2>Feed Config Details</h2>
		<dl>
			<dt>Title</dt>
			<dd>{selectedFeedConfig?.title}</dd>

			<dt>Description</dt>
			<dd>{selectedFeedConfig?.description}</dd>

			<dt>URL</dt>
			<dd>{selectedFeedConfig?.url}</dd>

			<dt>Feed Type</dt>
			<dd>{selectedFeedConfig?.feed_type}</dd>

			<dt>Proxy</dt>
			<dd>{selectedFeedConfig?.proxy || 'none'}</dd>

			<dt>Scan Interval</dt>
			<dd>{selectedFeedConfig?.scan_interval}</dd>

			<dt>Last Checked</dt>
			<dd>{selectedFeedConfig?.last_checked}</dd>

			<dt>Last Updated</dt>
			<dd>{selectedFeedConfig?.last_updated}</dd>

			<dt>ETag</dt>
			<dd>{selectedFeedConfig?.etag || 'none'}</dd>
		</dl>
		<footer>
			<button onclick={resetActionState}> Close </button>
		</footer>
	</article>
</dialog>

<dialog open={selectedFeedConfig !== null && selectedAction === 'delete'}>
	<article>
		<h2>Are you sure?</h2>
		<p>Do you want to delete <b>{selectedFeedConfig?.title}</b></p>
		<footer>
			<button class="secondary" onclick={resetActionState}> Cancel </button>
			<button class="pico-background-red-500" onclick={() => deleteFeedConfig(selectedFeedConfig!)}>
				Delete
			</button>
		</footer>
	</article>
</dialog>

<dialog open={(selectedAction === 'new' || selectedAction === 'edit') && feedConfigForm !== null}>
	{#if feedConfigForm !== null}
		<article class="feed-config-form">
			{#if selectedAction === 'edit'}
				<h2>Edit Feed Config</h2>
			{:else}
				<h2>New Feed Config</h2>
			{/if}
			<form onsubmit={submitFeedConfigForm}>
				<fieldset>
					<label for="url"> URL </label>
					<!-- svelte-ignore a11y_no_redundant_roles -->
					<!-- svelte-ignore a11y_role_supports_aria_props -->
					<fieldset role="group" aria-invalid={urlFetchError !== ''}>
						<fieldset>
							<input
								id="url"
								type="text"
								required
								pattern="https?://.+\..+"
								placeholder="https://..."
								bind:value={feedConfigForm.url}
								aria-invalid={urlFetchError !== '' ? true : undefined}
							/>
						</fieldset>
						<button type="button" onclick={getFeedDetails}>Fetch</button>
					</fieldset>
					{#if urlFetchError}
						<small class="error">{urlFetchError}</small>
					{/if}

					<details>
						<summary>Advanced</summary>

						<label for="proxy"> Proxy </label>
						<select id="proxy" bind:value={feedConfigForm.proxy}>
							<option value="" selected>None</option>
							<option value="cors-relay">CORS Relay</option>
						</select>

						<label for="feed_type"> Feed Type </label>
						<select id="feed_type" bind:value={feedConfigForm.feed_type}>
							<option value="rss">RSS</option>
							<option value="atom">Atom</option>
							<option value="unknown">Unknown</option>
						</select>
					</details>

					<hr />

					<label for="title"> Title </label>
					<input id="title" type="text" required bind:value={feedConfigForm.title} />

					<label for="description"> Description </label>
					<textarea id="description" bind:value={feedConfigForm.description}></textarea>

					<label for="scan_interval"> Scan Interval </label>
					<input
						id="scan_interval"
						type="text"
						required
						bind:value={feedConfigForm.scan_interval}
					/>
					<small>ex: 5m, 4h, 1d, 2w</small>
				</fieldset>
				<footer class="buttons">
					<button type="button" class="secondary" onclick={resetActionState}> Cancel </button>
					<button type="submit">Save</button>
				</footer>
			</form>
		</article>
	{/if}
</dialog>

<style lang="scss">
	h1,
	h1 + button {
		margin: 0 0.5rem 0.5em;
	}

	.actions {
		& > * {
			margin: 0;
		}

		details {
			width: 4.5em;
		}
	}

	.feed-list {
		.feed-entry {
			cursor: pointer;
		}
	}

	.feed {
		.entry {
			> hgroup {
				cursor: pointer;
			}
			> .description {
				font-size: small;
			}
		}
	}

	.entry-list {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-areas: 'entries article';

		> table {
			grid-area: entries;
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

	.feed-config-form {
		.buttons {
			display: flex;
			justify-content: flex-end;
			gap: 0.5em;
		}
	}
</style>
