/// <reference path="./env.d.ts" />

import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import mkcert from 'vite-plugin-mkcert';
import crossOriginIsolation from 'vite-plugin-cross-origin-isolation';

export default defineConfig({
	build: {
		target: 'esnext',
	},
	css: {
		preprocessorOptions: {
			scss: {
				api: 'modern-compiler',
			},
		}
	},
	plugins: [sveltekit(), mkcert(), crossOriginIsolation()],
	server: {
		https: true,
		proxy: {},
	},
	optimizeDeps: {
		exclude: ['@sqlite.org/sqlite-wasm'],
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
