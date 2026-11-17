import { defineConfig } from 'vite-plus';

// Unit tests cover pure logic (message validation, dataset parsing, wall geometry), so they run
// without the app's server plugins: Nitro and TanStack Start expect a full dev server.
export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        environment: 'node'
    }
});
