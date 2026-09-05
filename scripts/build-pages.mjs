import { spawnSync } from 'node:child_process';

// Build a second, real Pages artifact without changing the normal dist/ used by Vercel.
const result = spawnSync(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'dist-pages'],
  {
    env: { ...process.env, VITE_BASE_PATH: '/pages-check/' },
    stdio: 'inherit',
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
