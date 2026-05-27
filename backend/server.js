const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const CF_DNS = process.env.CF_DNS || '';
const CF_ACCESS = process.env.CF_ACCESS || '';
const ACCOUNT = '37ec01d5489bf05685115dd1c195c512';
const ZONE_UK = '8c5417878f88d14a648711efd68b56e4';
const DIST = path.join(__dirname, 'frontend/dist');
const CONFIG_FILE = '/data/access-config.json';
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

function loadConfig() {
  try { if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch(e) {}
  return {};
}
function saveConfig(cfg) {
  try { fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true }); fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); return true; } catch(e) { return false; }
}

// Cloudflare API helper
function cfApi(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'api.cloudflare.com', path, method, headers: { 'Authorization': `Bearer ${CF_ACCESS}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{ resolve(JSON.parse(d)); }catch(e){ resolve({success:false,errors:[{message:e.message}]}); } }); });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// DNS API helper (for listing domains)
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
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(data);
  });
}

function readBody(req) {
  return new Promise(resolve => { let b=''; req.on('data',c=>b+=c); req.on('end',()=>resolve(b)); });
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = req.url.split('?')[0];

  // GET /api/domains - list with protection + access status
  if (url === '/api/domains' && req.method === 'GET') {
    try {
      const config = loadConfig();
      const [records, accessApps] = await Promise.all([
        dnsApi(`/client/v4/zones/${ZONE_UK}/dns_records?per_page=50`),
        cfApi(`/client/v4/accounts/${ACCOUNT}/access/apps`)
      ]);
      
      const cfDomains = new Set((accessApps.result || []).map(a => a.domain));
      
      const domains = (records.result || []).filter(r => r.type === 'A').map(r => ({
        id: r.id, name: r.name, content: r.content, proxied: r.proxied,
        protection: config[r.name] || (cfDomains.has(r.name) ? 'cloudflare' : 'none'),
        hasAccess: cfDomains.has(r.name)
      }));
      
      // Add manual domains
      for (const [name, type] of Object.entries(config)) {
        if (!domains.find(d => d.name === name)) {
          domains.push({ id: 'manual-' + name, name, content: '-', proxied: false, protection: type, hasAccess: cfDomains.has(name) });
        }
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(domains.sort((a, b) => a.name.localeCompare(b.name))));
    } catch(e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/protection/set
  if (url === '/api/protection/set' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    const config = loadConfig();
    if (body.type === 'none') delete config[body.name];
    else config[body.name] = body.type;
    saveConfig(config);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // POST /api/protection/add
  if (url === '/api/protection/add' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    const config = loadConfig();
    config[body.name] = body.type;
    saveConfig(config);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // POST /api/access/create - create Zero Trust application
  if (url === '/api/access/create' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    try {
      const result = await cfApi(`/client/v4/accounts/${ACCOUNT}/access/apps`, 'POST', {
        name: body.name,
        domain: body.domain,
        type: 'self_hosted',
        session_duration: '24h',
        policies: [{
          name: 'Allow',
          decision: 'allow',
          include: [{ email: { email: body.email || 'gi.pierogiglio@gmail.com' } }]
        }]
      });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch(e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // DELETE /api/access/remove - remove Zero Trust application
  if (url === '/api/access/remove' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    try {
      const apps = await cfApi(`/client/v4/accounts/${ACCOUNT}/access/apps`);
      const app = (apps.result || []).find(a => a.domain === body.domain);
      if (app) {
        await cfApi(`/client/v4/accounts/${ACCOUNT}/access/apps/${app.id}`, 'DELETE');
        res.end(JSON.stringify({ success: true }));
      } else {
        res.end(JSON.stringify({ success: false, error: 'App not found' }));
      }
    } catch(e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  serveStatic(url, res);
}).listen(process.env.PORT || 3001, '0.0.0.0', () => console.log('[DASH] OK'));
