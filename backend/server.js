/**
 * server.js (Orchestrateur Local)
 * ──────────────────────────────
 * Lance et supervise les 3 microservices locaux en parallèle.
 * Redirige proprement leurs logs et gère l'arrêt global (Ctrl+C).
 */

const { fork } = require('child_process');
const path = require('path');

const services = [
    { name: 'Frontend',        dir: '../frontend',     port: 9000 },
    { name: 'API Gateway',     dir: 'api-gateway',     port: 3000 },
    { name: 'Ticket Service',  dir: 'ticket-service',  port: 3001 },
    { name: 'Admin Service',   dir: 'admin-service',   port: 3002 }
];

const children = [];

console.log('🚀 Démarrage des microservices Plate-Verification...\n');
console.log('🔗 Interface principale (Frontend) : \x1b[34m\x1b[4mhttp://localhost:9000/index.html\x1b[0m\n');

services.forEach(srv => {
    const srvPath = path.join(__dirname, srv.dir, 'server.js');
    
    // Spawne le processus node
    const child = fork(srvPath, [], {
        cwd: path.join(__dirname, srv.dir),
        env: { ...process.env, PORT: srv.port },
        silent: true
      });

    child.stdout.on('data', (data) => {
        console.log(`[\x1b[36m${srv.name}\x1b[0m] ${data.toString().trim()}`);
    });

    child.stderr.on('data', (data) => {
        console.error(`[\x1b[31m${srv.name} ERROR\x1b[0m] ${data.toString().trim()}`);
    });

    child.on('close', (code) => {
        console.log(`[\x1b[33m${srv.name}\x1b[0m] Arrêté avec le code ${code}`);
    });

    children.push(child);
});

// Gestionnaire d'arrêt propre (Ctrl+C)
process.on('SIGINT', () => {
    console.log('\n\n🛑 Arrêt en cours de tous les microservices...');
    children.forEach(child => {
        if (!child.killed) child.kill('SIGINT');
    });
    setTimeout(() => {
        console.log('✓ Tous les services sont arrêtés. Bonne journée !');
        process.exit(0);
    }, 500);
});
