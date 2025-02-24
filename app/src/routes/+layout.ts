import { dev } from '$app/environment';
import { onMount } from 'svelte';

// SSH left on, as disabling does not appear to play-nice with +page.server.ts
// export const ssr = false;

// onMount(() => {
//     navigator.serviceWorker?.register('./src/service-worker/index.ts', {
//         type: dev ? 'module' : 'classic'
//     });
// });
