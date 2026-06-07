# Dashboard Telemetrica AI-Hardware

Web dashboard in Node.js per il monitoraggio in tempo reale dell'hardware dedicato all'AI (GPU NVIDIA, ventole, sistema).

## Descrizione

Raccoglie telemetrie da:
- **GPU NVIDIA** (P40 + RTX 3050): temperatura, VRAM, utilizzazione, consumo energetico via `nvidia-smi`
- **Ventole**: lettura diretta da `/sys/class/hwmon` (inclusa P40 con ventola dedicata a 24V)
- **Sistema**: CPU, RAM, disco, uptime, journal systemd, servizi running
- **Alert**: push su Telegram se VRAM >85% o temperatura P40 >75°C

## Architettura

```
src/
├── server.js              # HTTP server (port 9200) + polling loop
├── collectors/
│   ├── nvidia.js          # nvidia-smi query (VRAM, temp, power, util)
│   ├── system.js          # CPU, RAM, disco, uptime, journal, servizi
│   └── fans.js            # hwmon fan RPM
├── alerts/
│   └── telegram.js        # Invio alert Telegram (HTTP POST)
└── dashboard/
    └── index.html         # Frontend dark theme (auto-refresh 10s)
config/
└── default.json           # Configurazione (porte, soglie, Telegram)
```

**Flusso dati:**
1. `server.js` avvia polling ogni 10 secondi (configurabile)
2. Ogni ciclo chiama tutti i collector in sequenza
3. `nvidia.getAlerts()` valuta soglie VRAM/temp
4. Se ci sono alert → `telegram.processAlerts()` invia notifica
5. Frontend HTML legge `/api/data` via fetch e aggiorna la UI

## Installazione

```bash
cd .
node src/server.js
```

Nessuna dipendenza esterna (usa solo moduli standard Node.js).

Configurazione in `config/default.json`:

| Parametro | Default | Descrizione |
|-----------|---------|-------------|
| `server.port` | 9200 | Porta del server HTTP |
| `server.host` | 0.0.0.0 | Binding |
| `polling.intervalMs` | 10000 | Intervallo raccolta dati (ms) |
| `polling.journalLines` | 50 | Righe journal da mostrare |
| `alerts.vramThresholdPct` | 85 | Soglia VRAM alert (%) |
| `alerts.p40TempThresholdC` | 75 | Soglia temp P40 alert (°C) |
| `alerts.cpuLoadThresholdPct` | 90 | Soglia carico CPU alert (%) |
| `alerts.telegramEnabled` | true | Abilita alert Telegram |
| `alerts.telegramToken` | "" | Bot token Telegram |
| `alerts.telegramChatId` | "" | Chat ID Telegram |

## Uso

### Avvio

```bash
node src/server.js
```

Il server avvia il polling immediato e continua in background.

### API Endpoints

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/` | GET | Dashboard HTML |
| `/api/data` | GET | Tutti i dati raccolti |
| `/api/nvidia` | GET | Solo dati GPU |
| `/api/system` | GET | Solo dati sistema |
| `/api/fans` | GET | Solo dati ventole |
| `/api/alerts` | GET | Alert correnti |
| `/api/journal?n=50` | GET | Ultimi N log di systemd |
| `/api/services` | GET | Servizi in esecuzione |
| `/api/refresh` | POST | Forza raccolta dati immediata |

### Dashboard

Apri `http://localhost:9200` nel browser. La dashboard mostra:
- Card GPU con barre VRAM/temp/utilizzazione (colori verde/giallo/rosso)
- Card sistema: CPU load, RAM, disco, uptime
- Card ventole con RPM
- Card journal systemd con scroll
- Card servizi running
- Banner alert rosso quando le soglie vengono superate
- Aggiornamento automatico ogni 10 secondi

### Esempi

```bash
# Query dati GPU via curl
curl http://localhost:9200/api/nvidia

# Query journal systemd
curl http://localhost:9200/api/journal?n=20

# Forza refresh immediato
curl -X POST http://localhost:9200/api/refresh
```

## Stato

**Completato** — 2026-06-06

Tutte le 4 fasi del piano sono state eseguite:
- [x] Struttura e analisi
- [x] Implementazione (server, collector, alert, dashboard)
- [x] Test e verifica
- [x] Documentazione
