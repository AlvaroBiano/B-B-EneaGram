/**
 * Teste Eneagrama — Servidor para Fly.io / produção
 * Stack: Node + SQLite nativo + Puppeteer (@sparticuz/chromium)
 * - Roda em qualquer Linux (Fly.io, Render, Railway)
 * - Persiste SQLite em /data/eneagrama.db (volume persistente do Fly.io)
 * - Gera PDF via Chromium headless serverless-compatible
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3911;
const PUBLIC_DIR = path.join(__dirname, 'public');
// DB_PATH: /var/data/eneagrama.db com persistent disk (Render Standard+)
//          /data/eneagrama.db no Fly.io (volume)
//          /tmp/eneagrama.db como fallback (Render Free sem persistent disk)
const DB_PATH = process.env.DB_PATH || '/tmp/eneagrama.db';

// ---- Chromium headless (compatível com Fly.io/Lambda) ----
let chromium;
try {
  chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
} catch (e) {
  chromium = null;
}
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch (e) {
  puppeteer = require('puppeteer');
}

let _chromePath = null;
async function getChromePath() {
  if (_chromePath) return _chromePath;
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    _chromePath = process.env.CHROME_PATH;
    return _chromePath;
  }
  if (chromium && chromium.executablePath) {
    _chromePath = await chromium.executablePath();
    return _chromePath;
  }
  // fallback para dev local (Mac/Chrome instalado)
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(macChrome)) { _chromePath = macChrome; return _chromePath; }
  throw new Error('Chromium não encontrado. Defina CHROME_PATH ou instale @sparticuz/chromium.');
}

// ---- Banco de dados ----
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS resultados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    whatsapp TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    dominante TEXT,
    dominante_exibicao TEXT,
    percentual INTEGER,
    empate INTEGER DEFAULT 0,
    respostas TEXT DEFAULT '{}',
    totais TEXT DEFAULT '{}',
    bars TEXT
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    login TEXT NOT NULL,
    senha TEXT NOT NULL
  );
`);
const adminExists = db.prepare('SELECT COUNT(*) c FROM admin WHERE id=1').get().c;
if (!adminExists) {
  db.prepare('INSERT INTO admin (id, login, senha) VALUES (1, ?, ?)').run('alvarobiano', 'AeSm1979@#');
}

// Migração leve: adiciona colunas se não existirem
const cols = db.prepare("PRAGMA table_info(resultados)").all().map(c => c.name);
if (!cols.includes('dominante_exibicao')) db.exec('ALTER TABLE resultados ADD COLUMN dominante_exibicao TEXT');
if (!cols.includes('bars')) db.exec('ALTER TABLE resultados ADD COLUMN bars TEXT');
if (!cols.includes('lingua')) db.exec("ALTER TABLE resultados ADD COLUMN lingua TEXT DEFAULT 'pt-BR'");

function saveResult(data) {
  const stmt = db.prepare(`
    INSERT INTO resultados (nome, whatsapp, dominante, dominante_exibicao, percentual, empate, respostas, totais, bars, lingua)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    data.nome,
    data.whatsapp || '',
    data.dominante || '',
    data.dominanteExibicao || data.dominante || '',
    data.percentual,
    data.empate,
    JSON.stringify(data.respostas),
    JSON.stringify(data.totais),
    Array.isArray(data.bars) ? JSON.stringify(data.bars) : '[]',
    (typeof data.lingua === 'string' && I18N_LOCALES.includes(data.lingua)) ? data.lingua : 'pt-BR'
  );
  return info.lastInsertRowid;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ---- i18n: servir arquivos de tradução ----
const I18N_DIR = path.join(PUBLIC_DIR, 'i18n');
const I18N_LOCALES = ['pt-BR', 'en-US', 'fr-FR', 'es-ES', 'de-DE'];

function readI18n(locale) {
  // Normaliza: pt-BR ou pt_br → pt-BR
  const norm = locale.replace('_', '-').toLowerCase();
  let lc = I18N_LOCALES.find(l => l.toLowerCase() === norm);
  // Fallback inteligente: fr-ca → fr-FR, es-mx → es-ES, en-gb → en-US, de-ch → de-DE
  if (!lc) {
    const lang = norm.split('-')[0];
    if (lang === 'fr') lc = 'fr-FR';
    else if (lang === 'es') lc = 'es-ES';
    else if (lang === 'en') lc = 'en-US';
    else if (lang === 'de') lc = 'de-DE';
    else if (lang === 'pt') lc = 'pt-BR';
    else lc = 'pt-BR';
  }
  try {
    return JSON.parse(fs.readFileSync(path.join(I18N_DIR, lc + '.json'), 'utf-8'));
  } catch (e) {
    return JSON.parse(fs.readFileSync(path.join(I18N_DIR, 'pt-BR.json'), 'utf-8'));
  }
}

// ---- Gerar PDF via Puppeteer (Fly.io Linux-compatible) ----
async function generatePdf(result, res) {
  const html = buildResultHtml(result);
  let browser;
  try {
    const execPath = await getChromePath();
    const args = chromium && chromium.args ? chromium.args : [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--headless=new', '--hide-scrollbars'
    ];
    browser = await puppeteer.launch({
      executablePath: execPath,
      args,
      headless: 'new',
      defaultViewport: { width: 900, height: 1200 }
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '14mm', right: '14mm' }
    });
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Eneagrama-${result.nome.replace(/\W+/g,'-')}.pdf"`,
      'Cache-Control': 'no-store'
    });
    res.end(pdf);
  } catch (e) {
    console.error('PDF erro:', e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erro ao gerar PDF: ' + e.message }));
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
    if (chromium && typeof chromium.close === 'function') {
      try { await chromium.close(); } catch (e) { /* ignore */ }
    }
  }
}

function buildResultHtml(r) {
  const percentual = r.percentual != null ? r.percentual : 0;
  const isEmpate = r.empate;
  const domLine = isEmpate
    ? `<p class="dom-empate">✅ Múltiplos tipos dominantes (empate)</p>`
    : `<p class="dom-single">✅ Tipo dominante</p>`;
  const badge = isEmpate ? 'Empate' : 'Tipo dominante';
  const lines = (r.bars || []).map(b => `
    <div class="bar-row">
      <div class="bar-label"><strong>Tipo ${b.num}</strong> — ${b.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(b.pct,4)}%">${b.pct}%</div></div>
    </div>`).join('');
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif; color:#1e293b; padding:0; background:#fff; }
  .page { max-width: 210mm; margin:0 auto; padding: 32px 36px; }
  .logo { font-size:13px; letter-spacing:1px; text-transform:uppercase; color:#6366f1; margin-bottom:4px; font-weight:600; }
  h1 { font-size: 24px; color:#0f172a; margin-bottom: 4px; }
  .who { color:#64748b; font-size:14px; margin-bottom:20px; }
  .badge { display:inline-block; background:#6366f1; color:#fff; padding:3px 14px; border-radius:20px; font-size:12px; }
  .card { border:1px solid #e2e8f0; border-radius:16px; padding:24px 28px; margin-top:16px; }
  .card h2 { font-size:15px; color:#475569; margin-bottom:6px; font-weight:600; }
  .big { font-size:32px; font-weight:800; color:#6366f1; line-height:1.2; }
  .score { margin-top:8px; font-size:15px; color:#334155; }
  .score strong { color:#f59e0b; font-weight:800; }
  .bars { margin-top:20px; }
  .bar-row { display:flex; align-items:center; gap:10px; margin-bottom:9px; font-size:13px; }
  .bar-label { width:190px; text-align:right; color:#334155; }
  .bar-track { flex:1; height:18px; background:#eef2ff; border-radius:6px; overflow:hidden; }
  .bar-fill { height:100%; background:linear-gradient(90deg,#6366f1,#8b5cf6); border-radius:6px; min-width:14px; text-align:right; padding-right:5px; color:#fff; font-size:11px; line-height:18px; }
  .legal { margin-top:22px; padding-top:14px; border-top:1px solid #e2e8f0; color:#94a3b8; font-size:11px; line-height:1.5; }
  .footer { margin-top:16px; font-size:12px; color:#94a3b8; }
</style></head>
<body>
<div class="page">
  <div class="logo">Eneagrama · Avaliação de Personalidade</div>
  <h1>Resultado da Avaliação</h1>
  <p class="who">${r.nome}${r.whatsapp ? ' · ' + r.whatsapp : ''} · ${new Date().toLocaleDateString('pt-BR')}</p>
  <div class="badge">${badge}</div>

  <div class="card">
    <h2>Personalidade dominante</h2>
    ${domLine}
    <div class="big">${r.dominanteExibicao || r.dominante || ''}</div>
    <div class="score"><strong>${percentual}%</strong> de identificação</div>
  </div>

  <div class="card">
    <h2>Perfil completo (9 tendências)</h2>
    <div class="bars">${lines}</div>
  </div>

  <div class="legal">
    <strong>Aviso:</strong> As pontuações indicam tendências relativas entre os tipos. Resultados próximos ou empatados devem ser lidos em conjunto com as respostas — não como diagnóstico. A classificação é a mesma para qualquer gênero.
  </div>
  <div class="footer">Resultado gerado em ${new Date().toLocaleString('pt-BR')}</div>
</div>
</body></html>`;
}

// ---- HTTP Server ----
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Servir arquivos estáticos (i18n.js e JSONs de tradução)
  if (url.pathname === '/i18n.js' || url.pathname.startsWith('/i18n/')) {
    try {
      const filePath = path.join(PUBLIC_DIR, url.pathname);
      const content = fs.readFileSync(filePath);
      const ct = url.pathname.endsWith('.json') ? 'application/json; charset=utf-8' : 'application/javascript; charset=utf-8';
      res.writeHead(200, {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=300'
      });
      res.end(content);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Arquivo não encontrado' }));
    }
    return;
  }

  // Servir index.html (front)
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(fs.readFileSync(path.join(PUBLIC_DIR, 'index.html')));
    return;
  }

  // Salvar resultado + gerar PDF
  if (url.pathname === '/api/enviar' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body.nome || !body.dominante) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Nome e resultado obrigatórios' }));
        return;
      }
      const id = saveResult(body);
      const result = { ...body, id };
      await generatePdf(result, res);
    } catch (e) {
      console.error(e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erro: ' + e.message }));
    }
    return;
  }

  // Endpoint i18n: lista idiomas disponíveis
  if (url.pathname === '/api/traducoes' && req.method === 'GET') {
    const list = I18N_LOCALES.map(lc => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(I18N_DIR, lc + '.json'), 'utf-8'));
        return { locale: lc, language_name: data.language_name, flag: data.flag };
      } catch (e) { return { locale: lc, error: 'load failed' }; }
    });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' });
    res.end(JSON.stringify(list));
    return;
  }

  // Endpoint i18n: retorna JSON do idioma (com fallback inteligente)
  if (url.pathname.startsWith('/api/i18n/') && req.method === 'GET') {
    const locale = decodeURIComponent(url.pathname.replace('/api/i18n/', ''));
    const data = readI18n(locale);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(JSON.stringify(data));
    return;
  }

  // Endpoint de login admin (server-side via tabela)
  if (url.pathname === '/api/admin/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const row = db.prepare('SELECT login, senha FROM admin WHERE id=1').get();
      if (row && body.user === row.login && body.pass === row.senha) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Login ou senha incorretos' }));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erro: ' + e.message }));
    }
    return;
  }

  // Endpoint para editar perfil admin
  if (url.pathname === '/api/admin/atualizar' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const row = db.prepare('SELECT login, senha FROM admin WHERE id=1').get();
      if (!row || body.senha_atual !== row.senha) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Senha atual incorreta' }));
        return;
      }
      const novoLogin = (body.novo_login || '').trim();
      const novaSenha = (body.nova_senha || '').trim();
      if (!novoLogin || !novaSenha) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Login e senha não podem ser vazios' }));
        return;
      }
      db.prepare('UPDATE admin SET login=?, senha=? WHERE id=1').run(novoLogin, novaSenha);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, login: novoLogin }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erro: ' + e.message }));
    }
    return;
  }

  // Endpoint para excluir um registro
  if (url.pathname.startsWith('/api/admin/registros/') && req.method === 'DELETE') {
    const idStr = url.pathname.split('/').pop();
    const id = parseInt(idStr, 10);
    if (!Number.isInteger(id) || id <= 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ID inválido' }));
      return;
    }
    try {
      const info = db.prepare('DELETE FROM resultados WHERE id=?').run(id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, removidos: info.changes }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erro: ' + e.message }));
    }
    return;
  }

  // Endpoint administrativo - lista registros (com paginação)
  if (url.pathname === '/api/admin/registros' && req.method === 'GET') {
    try {
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const perPage = 10;
      const offset = (page - 1) * perPage;
      const total = db.prepare('SELECT COUNT(*) c FROM resultados').get().c;
      const rows = db.prepare(`
        SELECT id, nome, whatsapp, dominante, dominante_exibicao, percentual, empate, criado_em, bars, respostas, totais, lingua
        FROM resultados
        ORDER BY criado_em DESC, id DESC
        LIMIT ? OFFSET ?
      `).all(perPage, offset);
      rows.forEach(r => {
        try { r.bars = JSON.parse(r.bars || '[]'); } catch(e) { r.bars = []; }
        try { r.totais = JSON.parse(r.totais || '{}'); } catch(e) { r.totais = {}; }
        try { r.respostas = JSON.parse(r.respostas || '{}'); } catch(e) { r.respostas = {}; }
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ page, perPage, total, totalPages: Math.ceil(total / perPage), rows }));
    } catch (e) {
      console.error(e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erro ao buscar registros: ' + e.message }));
    }
    return;
  }

  // Health check (Fly.io ping)
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, version: '1.0', db: fs.existsSync(DB_PATH) }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Rota não encontrada' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Teste Eneagrama rodando em: 0.0.0.0:${PORT}`);
  console.log(`   Banco: ${DB_PATH}`);
});