// The Windows sandbox cannot resolve ancestor directories with realpath.
// Keep module paths intact while using the same plugin and base as vite.config.ts.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
await build({ configFile: false, plugins: [react()], base: '/jj-trading-hub/', resolve: { preserveSymlinks: true } });
