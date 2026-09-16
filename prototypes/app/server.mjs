import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('./', import.meta.url);
const files = ['index.html','components.html','app.js','tasks.js','pages.js','ui.js','data.js','components.js','ui.css'];
const routes = new Map(files.map(name => ['/' + name, new URL(name, root)]));
routes.set('/', new URL('index.html', root));
routes.set('/assets/geist.woff2', new URL('../../src/app/fonts/geist-latin.woff2', root));
const types = {html:'text/html; charset=utf-8', js:'text/javascript; charset=utf-8', css:'text/css; charset=utf-8', woff2:'font/woff2'};
createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = routes.get(pathname);
  if(!file){
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  try{
    res.writeHead(200, {'Content-Type': types[fileURLToPath(file).split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    res.end(await readFile(file));
  }catch{
    res.writeHead(500);
    res.end('File unavailable');
  }
}).listen(4318, '127.0.0.1', () => console.log('App prototype: http://127.0.0.1:4318'));
