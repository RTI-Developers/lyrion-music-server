import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Integration tests talk to real servers and spawn real processes.
        // The Spotify plugin can take up to ~60 s to begin streaming after playDirectUrl.
        testTimeout: 180_000,
        hookTimeout:  30_000,
    },
});
