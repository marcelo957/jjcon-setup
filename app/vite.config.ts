import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The Edge Function imports the client the way Supabase's runtime does; tests use the installed one.
  resolve: { alias: [{ find: /^npm:@supabase\/supabase-js@[\d.]+$/, replacement: new URL('./node_modules/@supabase/supabase-js/dist/index.mjs', import.meta.url).pathname }] },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // The first console render in each file evaluates the 1.9 MB Bushido bundle.
    testTimeout: 20_000
  }
});
