import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';

// Map /law/data/* (the URL the data layer fetches from) -> <repo>/law/data/* on disk.
// Dev only; production deploy story is deferred.
function lawDataMiddleware() {
  const root = path.resolve(__dirname, '../data');
  return {
    name: 'law-data-dev',
    configureServer(server: { middlewares: { use: (path: string, fn: (req: { url?: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: () => void }, next: () => void) => void) => void } }) {
      server.middlewares.use('/law/data', (req, res, next) => {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const filePath = path.join(root, urlPath);
        if (!filePath.startsWith(root)) {
          res.statusCode = 403;
          return res.end();
        }
        fs.stat(filePath, (err, stat) => {
          if (err || !stat.isFile()) return next();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          fs.createReadStream(filePath).pipe(res as unknown as NodeJS.WritableStream);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), lawDataMiddleware()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5173, strictPort: false },
});
