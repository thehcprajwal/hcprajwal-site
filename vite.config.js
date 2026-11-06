import { defineConfig } from 'vite';

export default defineConfig({
    root:      'src',
    publicDir: '../public',
    base:      '/',
    server: {
        port: 3000,
        open: true,
        proxy: {
            '/api': {
                target:       'http://localhost:3001',
                changeOrigin: true
            }
        }
    },
    build: {
        outDir:     '../dist',
        emptyOutDir: true,
        rollupOptions: {
            // three.js is large and rarely changes: its own file means visitors re-download it less often
            output: { manualChunks: { three: ['three'] } }
        }
    }
});
