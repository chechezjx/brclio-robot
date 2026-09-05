// QA-only static server: no SPA fallback, serves dist at / and at a Pages-style subpath.
// A missing JS, CSS or icon really returns 404, so deployment tests catch bad asset URLs.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const mounts = [
  { path: '/pages-check', root: resolve('dist-pages') },
  { path: '/brclio-robot', root: resolve('dist') },
];
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
};
createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const mount = mounts.find(
      (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
    );
    if (mount && pathname === mount.path) {
      response.writeHead(301, { Location: `${mount.path}/` });
      response.end();
      return;
    }
    const root = mount?.root ?? resolve('dist');
    if (mount) pathname = pathname.slice(mount.path.length);
    let filename = resolve(root, `.${pathname}`);
    if (filename !== root && !filename.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    if ((await stat(filename)).isDirectory()) filename = resolve(filename, 'index.html');
    const content = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': mime[extname(filename)] || 'application/octet-stream',
    });
    response.end(content);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(4174, '127.0.0.1', () => console.log('Deployment QA server: http://localhost:4174/'));
