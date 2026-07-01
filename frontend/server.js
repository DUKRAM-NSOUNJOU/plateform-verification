/**
 * server.js (Serveur Statique Frontend)
 * ────────────────────────────────────
 * Serveur HTTP natif Node.js (sans dépendances) pour héberger
 * les fichiers statiques du frontend sur le port 9000.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 9000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css':  'text/css',
    '.js':   'text/javascript',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.json': 'application/json'
};

const server = http.createServer((req, res) => {
    // Nettoyer l'URL pour éviter la navigation en dehors du dossier
    const safeUrl = req.url.split('?')[0];
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
});
