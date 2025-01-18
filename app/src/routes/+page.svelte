<script lang="ts">
	// import ThemeSwitcher from '$lib/components/theme-switcher.svelte';
	import type {
		FeedConfigFormData,
		ListFeedConfigResponse,
		MessagePayload,
		MessageResponse,
		WorkerContextState
	} from '$lib/types';
	import {
		formatDate,
		getFetchURL,
		getLastUpdated,
		parseScanInterval,
		refreshFeed
	} from '$lib/helpers';
	import { getContext, onDestroy, onMount } from 'svelte';
	import { fetchFeedDetails } from '$lib/requests';
	import { NEW_FEED_CONFIG } from '$lib/consts';
	import { goto } from '$app/navigation';

	const postMessage = getContext<(args: MessagePayload) => void>('postMessage');
	const workerState = getContext<WorkerContextState>('onMessageConnector');

	let feedConfigs: ListFeedConfigResponse = $state([]);
	let feedConfigsFetchLock: Record<number, boolean> = $state({});
	let feedScanInterval: number;

	onMount(async () => {
		feedScanInterval = setInterval(scanFeeds, 60_000);
	});
	onDestroy(() => {
		clearInterval(feedScanInterval);
	});

	workerState.callback = (event: MessageEvent<MessageResponse>) => {
		switch (event.data.message) {
			case 'feed-configs':
				console.debug('feed-configs', JSON.parse(JSON.stringify(event.data.feedConfigs)));

				feedConfigs = event.data.feedConfigs;

				if (feedConfigs.length === 0) {
					feedConfigForm = { ...NEW_FEED_CONFIG };
					selectedAction = 'new';
				} else {
					resetActionState();
					scanFeeds();
				}
				break;
			case 'feed-config-full': {
				const { html, ...feedConfig }: ListFeedConfigResponse[number] & { html: string } =
					event.data.data;
				console.debug('received feed-config-full', { ...feedConfig });

				const feedConfigIndex = feedConfigs.findIndex((fc) => fc.id === feedConfig.id);
				if (feedConfigIndex === -1) {
					feedConfigs = [...feedConfigs, event.data.data];
				} else {
					feedConfigs[feedConfigIndex] = event.data.data;
				}
				break;
			}
			default:
				console.log('unknown message', event.data);
		}
	};

	$effect(() => {
		if (workerState.ready) {
			postMessage({ message: 'list-feed-configs' });
		}
	});

	const lockAndRefreshFeed = async (
		feedConfig: ListFeedConfigResponse[number]
	): Promise<string> => {
		try {
			feedConfigsFetchLock[feedConfig.id] = true;
			const html = await refreshFeed(feedConfig, postMessage);
			feedConfigsFetchLock[feedConfig.id] = false;

			return html;
		} catch (error) {
			feedConfigsFetchLock[feedConfig.id] = false;
			console.error('failed', error);
			return '';
		}
	};

	const scanFeeds = async () => {
		if (!workerState.ready) {
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
			await lockAndRefreshFeed(feedConfig);
		}
	};

	let selectedAction: 'details' | 'new' | 'edit' | 'delete' | null = $state(null);
	let feedConfigForm: FeedConfigFormData | null = $state(null);
	let selectedFeedConfig: ListFeedConfigResponse[number] | null = $state(null);
	const resetActionState = () => {
		selectedAction = null;
		feedConfigForm = null;
		selectedFeedConfig = null;
	};

	let urlFetchError = $state('');
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
		postMessage({
			message: feedConfigForm.id === -1 ? 'insert-feed-config' : 'update-feed-config',
			feedConfig: { ...feedConfigForm }
		});

		resetActionState();
	};

	const deleteFeedConfig = (feedConfig: ListFeedConfigResponse[number]) => {
		postMessage({
			message: 'delete-feed-config',
			feedConfigId: feedConfig.id
		});
	};
</script>

<!-- WIP -->
<!-- <ThemeSwitcher /> -->

<!-- list of feed configs -->
<header>
	<h1>Feeds</h1>
	<button
		disabled={!workerState.ready}
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
						goto(`/${feedConfig.id}`);
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
							<ul
								onclickcapture={(e) => {
									(e.currentTarget.parentElement as HTMLDetailsElement).open = false;
								}}
							>
								<li>
									<a href="##" onclick={() => lockAndRefreshFeed({ ...feedConfig, etag: '' })}
										>Refresh</a
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

<dialog open={feedConfigForm !== null && (selectedAction === 'new' || selectedAction === 'edit')}>
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
	.feed-list {
		.feed-entry {
			cursor: pointer;
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
