import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
    plugins: [react(), cesium()],
    resolve: {
        alias: {
            // If additional aliases are needed, add them here
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    cesium: ['cesium'],
                },
            },
        },
    },
    server: {
        proxy: {
            '/Cesium': 'http://localhost:3000',
        },
    },
});
