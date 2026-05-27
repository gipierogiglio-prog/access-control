const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const CF_DNS = process.env.CF_DNS || '';
const CF_ACCESS = process.env.CF_ACCESS || '';
const ACCOUNT = '37ec01d5489bf05685115dd1c195c512';
const ZONES = {
  uk: { id: '8c5417878f88d14a648711efd68b56e4', name: 'devgiglio.uk' },
  com: { id: '6f471aee05adb5c7ea5828048b00c734', name: 'devgiglio.com' }
};
const DIST = path.join(__dirname, 'frontend/dist');
const CONFIG_FILE = '/data/access-config.json';
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };

function loadConfig() {
  try { if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch(e) {}
  return { emails: ['gi.pierogiglio@gmail.com'] };
}
function saveConfig(cfg) {
  try { fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true }); fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); return true; } catch(e) { return false; }
}

function cfApi(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'api.cloudflare.com', path, method, headers: { 'Authorization': `Bearer ${CF_ACCESS}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{ resolve(JSON.parse(d)); }catch(e){ resolve({success:false,errors:[{message:e.message}]}); } }); });
    req.on('error', reject); if (body) req.write(JSON.stringify(body)); req.end();
  });
}

function dnsApi(path) {
  return new Promise((resolve, reject) => {
    if (!CF_DNS) return resolve({ result: [] });
    const opts = { hostname: 'api.cloudflare.com', path, headers: { 'Authorization': `Bearer ${CF_DNS}` } };
    https.get(opts, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{ resolve(JSON.parse(d)); }catch(e){ reject(e); } }); }).on('error', reject);
  });
}

function serveStatic(url, res) {
  let filePath = url === '/' ? '/index.html' : url;
  const fullPath = path.join(DIST, filePath);
  if (!fullPath.startsWith(DIST)) { res.statusCode = 403; res.end(); return; }
  fs.readFile(fullPath, (err, data) => {
    if (err) { res.statusCode = 404; res.end('Not found'); return; }
    res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
    res.end(data);
  });
}

function readBody(req) { return new Promise(resolve => { let b=''; req.on('data',c=>b+=c); req.on('end',()=>resolve(b)); }); }

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = req.url.split('?')[0];

  // GET /api/domains - only domains with Zero Trust
  if (url === '/api/domains' && req.method === 'GET') {
    try {
      const accessApps = await cfApi(`/client/v4/accounts/${ACCOUNT}/access/apps`);
      const domains = (accessApps.result || []).map(a => ({
        id: a.id,
        name: a.domain,
        appName: a.name,
        created: a.created_at
      }));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ domains: domains.sort((a, b) => a.name.localeCompare(b.name)), config: { emails: (loadConfig().emails || ['gi.pierogiglio@gmail.com']) } }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // GET /api/subdomains - list A records from .uk zone for the select dropdown
  if (url === '/api/subdomains' && req.method === 'GET') {
    try {
      const records = await dnsApi(`/client/v4/zones/${ZONES.uk.id}/dns_records?per_page=50`);
      const subs = (records.result || []).filter(r => r.type === 'A').map(r => ({
        name: r.name.replace('.devgiglio.uk', ''),
        full: r.name
      }));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ uk: subs, zones: [{ name: 'devgiglio.uk' }, { name: 'devgiglio.com' }] }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // POST /api/emails/set
  if (url === '/api/emails/set' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    const config = loadConfig();
    config.emails = body.emails || ['gi.pierogiglio@gmail.com'];
    saveConfig(config);
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // POST /api/access/create
  if (url === '/api/access/create' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    const config = loadConfig();
    const emails = config.emails || ['gi.pierogiglio@gmail.com'];
    try {
      const policies = emails.map(email => ({
        name: `Allow ${email}`, decision: 'allow', include: [{ email: { email } }]
      }));
      const result = await cfApi(`/client/v4/accounts/${ACCOUNT}/access/apps`, 'POST', {
        name: body.name, domain: body.domain, type: 'self_hosted', session_duration: '24h', policies
      });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // POST /api/access/remove
  if (url === '/api/access/remove' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    try {
      const apps = await cfApi(`/client/v4/accounts/${ACCOUNT}/access/apps`);
      const app = (apps.result || []).find(a => a.domain === body.domain);
      if (app) {
        await cfApi(`/client/v4/accounts/${ACCOUNT}/access/apps/${app.id}`, 'DELETE');
        res.end(JSON.stringify({ success: true }));
      } else { res.end(JSON.stringify({ success: false, error: 'App not found' })); }
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // POST /api/access/sync
  if (url === '/api/access/sync' && req.method === 'POST') {
    const config = loadConfig();
    const emails = config.emails || ['gi.pierogiglio@gmail.com'];
    try {
      const apps = await cfApi(`/client/v4/accounts/${ACCOUNT}/access/apps`);
      const results = [];
      for (const app of (apps.result || [])) {
        const policies = emails.map(email => ({
          name: `Allow ${email}`, decision: 'allow', include: [{ email: { email } }]
        }));
        const update = await cfApi(`/client/v4/accounts/${ACCOUNT}/access/apps/${app.id}`, 'PUT', { ...app, policies });
        results.push({ domain: app.domain, success: update.success });
      }
      res.end(JSON.stringify({ success: true, results }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  serveStatic(url, res);
}).listen(process.env.PORT || 3001, '0.0.0.0', () => console.log('[DASH] OK'));
