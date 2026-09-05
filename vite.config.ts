import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  // Pages provides its actual base_path; relative assets also work on Vercel and Sites.
  base: process.env.VITE_BASE_PATH || './',
  test: { include: ['src/tests/**/*.test.ts'], environment: 'node' },
});
