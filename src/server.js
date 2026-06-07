const http = require('http');
const fs = require('fs');
const path = require('path');

const nvidia = require('./collectors/nvidia');
const system = require('./collectors/system');
const fans = require('./collectors/fans');
const telegram = require('./alerts/telegram');

const config = require(path.join(__dirname, '..', 'config', 'default.json'));

const PORT = config.server?.port || 9200;
const HOST = config.server?.host || '0.0.0.0';
const POLL_INTERVAL = config.polling?.intervalMs || 10000;

let latestData = null;
let latestAlerts = [];
let pollingTimer = null;

function collectAll() {
  try {
    const nvidiaData = nvidia.collect();
    const sysData = system.collect();
    const fanData = fans.collect();
    const alerts = nvidia.getAlerts(nvidiaData);

    latestData = {
      timestamp: new Date().toISOString(),
      nvidia: nvidiaData,
      system: sysData,
      fans: fanData,
      alerts
    };

    latestAlerts = alerts;

    if (alerts.length > 0) {
      telegram.processAlerts(alerts);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Errore raccolta dati:`, err.message);
  }
}

function startPolling() {
  collectAll();
  pollingTimer = setInterval(collectAll, POLL_INTERVAL);
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function htmlResponse(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    const dashboardPath = path.join(__dirname, '..', 'src', 'dashboard', 'index.html');
    fs.readFile(dashboardPath, 'utf-8', (err, data) => {
      if (err) {
        jsonResponse(res, 500, { error: 'Dashboard non trovata' });
        return;
      }
      htmlResponse(res, data);
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/data') {
    jsonResponse(res, 200, latestData || { error: 'Nessun dato disponibile' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/nvidia') {
    const data = nvidia.collect();
    jsonResponse(res, 200, data);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/system') {
    const data = system.collect();
    jsonResponse(res, 200, data);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/fans') {
    const data = fans.collect();
    jsonResponse(res, 200, data);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/alerts') {
    jsonResponse(res, 200, { alerts: latestAlerts, timestamp: new Date().toISOString() });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/journal') {
    const lines = parseInt(url.searchParams.get('n') || '50');
    const data = system.getJournalLines(lines);
    jsonResponse(res, 200, { lines: data, count: data.length });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/services') {
    const data = system.getRunningServices();
    jsonResponse(res, 200, { services: data, count: data.length });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/refresh') {
    collectAll();
    jsonResponse(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    return;
  }

  jsonResponse(res, 404, { error: 'Non trovato' });
});

server.listen(PORT, HOST, () => {
  console.log(`Dashboard telemetrica avviata su http://${HOST}:${PORT}`);
  console.log(`Intervallo polling: ${POLL_INTERVAL}ms`);
  console.log(`Soglie alert: VRAM >${config.alerts?.vramThresholdPct || 85}% | P40 Temp >${config.alerts?.p40TempThresholdC || 75}°C`);
});

process.on('SIGINT', () => {
  console.log('\nArresto in corso...');
  stopPolling();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  stopPolling();
  server.close(() => process.exit(0));
});

module.exports = { server, startPolling, stopPolling, collectAll };
