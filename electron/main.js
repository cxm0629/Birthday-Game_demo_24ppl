const { app, BrowserWindow, protocol, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const APP_URL = 'starlight://game/';
const ROOT_FILES = new Set([
  'index.html', 'app.js', 'styles.css', 'pixel-ui.css', 'fireworks.js',
  'people_data.json', 'ending-avatar-sprite.webp', 'xiaomi-chibi-1000.webp'
]);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4'
};

protocol.registerSchemesAsPrivileged([{
  scheme: 'starlight',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
}]);

function assetPath(requestUrl) {
  const url = new URL(requestUrl);
  if (url.hostname !== 'game') return null;
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return null; }
  if (pathname.includes('\\') || pathname.includes('\0')) return null;
  const relative = pathname.replace(/^\/+/, '') || 'index.html';
  if (!ROOT_FILES.has(relative) && !relative.startsWith('assets/') &&
      !relative.startsWith('01_Person Materials/')) return null;
  const root = app.getAppPath();
  const fullPath = path.resolve(root, relative);
  if (!fullPath.startsWith(root + path.sep)) return null;
  return fullPath;
}

async function serveAsset(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response(null, { status: 405 });
  const filePath = assetPath(request.url);
  if (!filePath) return new Response(null, { status: 404 });
  let bytes;
  try { bytes = await fs.readFile(filePath); }
  catch { return new Response(null, { status: 404 }); }

  const size = bytes.length;
  const headers = {
    'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store'
  };
  let status = 200;
  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    let start, end;
    if (!match[1]) {
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : size - 1;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= size)
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    status = 206;
    bytes = bytes.subarray(start, end + 1);
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = String(bytes.length);
  return new Response(request.method === 'HEAD' ? null : bytes, { status, headers });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280, height: 800, minWidth: 840, minHeight: 600,
    title: '星光来信', backgroundColor: '#102747', autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), 'build', 'icon.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== APP_URL) event.preventDefault();
  });
  window.webContents.on('did-finish-load', async () => {
    try {
      const css = await fs.readFile(path.join(app.getAppPath(), 'electron', 'desktop-layout.css'), 'utf8');
      await window.webContents.insertCSS(css);
    } catch (error) {
      console.error('Unable to load Electron desktop layout:', error);
    }
  });
  window.loadURL(APP_URL);
}

app.whenReady().then(() => {
  protocol.handle('starlight', serveAsset);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: /^https?:/i.test(details.url) });
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());
