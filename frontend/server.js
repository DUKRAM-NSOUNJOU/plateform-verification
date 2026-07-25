/**
 * server.js (Serveur Statique Frontend + Proxy API)
 * ──────────────────────────────────────────────────
 * Sert les fichiers statiques du frontend sur le port 9000
 * et proxy les requêtes /api/ vers l'API Gateway (port 3000).
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 9000;
const API_GATEWAY = process.env.API_GATEWAY_URL || 'http://localhost:3000';

const MIME_TYPES = {
    '.html': 'text/html',
    '.css':  'text/css',
    '.js':   'text/javascript',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.json': 'application/json',
    '.xml':  'application/xml'
};

const server = http.createServer((req, res) => {
    const safeUrl = req.url.split('?')[0];

    // Proxy les requêtes API vers le gateway
    if (safeUrl.startsWith('/api/')) {
        const options = {
            hostname: new URL(API_GATEWAY).hostname,
            port: new URL(API_GATEWAY).port || 3000,
            path: req.url,
            method: req.method,
            headers: { ...req.headers, host: new URL(API_GATEWAY).host }
        };
        const proxyReq = http.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });
        proxyReq.on('error', () => {
            res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'API Gateway indisponible.' }));
        });
        req.pipe(proxyReq);
        return;
    }

    // Servir les fichiers statiques
    let filePath = path.join(__dirname, safeUrl === '/' ? 'index.html' : safeUrl);

    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Accès interdit');
        return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 Fichier non trouvé');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('500 Erreur interne');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`✓ [Frontend]        http://localhost:${PORT}`);
    console.log(`  → API Gateway:    ${API_GATEWAY}`);
});
