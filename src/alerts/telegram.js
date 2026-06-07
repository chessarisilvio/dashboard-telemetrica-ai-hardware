const https = require('https');
const path = require('path');

const config = require(path.join(__dirname, '..', '..', 'config', 'default.json'));

function sendAlert(message) {
  if (!config.alerts?.telegramEnabled) return false;
  if (!config.alerts?.telegramToken || !config.alerts?.telegramChatId) return false;

  const token = config.alerts.telegramToken;
  const chatId = config.alerts.telegramChatId;

  const payload = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown'
  });

  const data = Buffer.from(payload);

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.ok === true);
        } catch {
          resolve(false);
        }
      });
    });

    req.on('error', () => resolve(false));
    req.setTimeout(10000, () => { req.destroy(); resolve(false); });
    req.write(data);
    req.end();
  });
}

async function processAlerts(alerts) {
  if (!alerts || alerts.length === 0) return;

  const lines = alerts.map(a => `⚠️ ${a.message}`).join('\n\n');
  const message = `🔔 *Alert Hardware*\n\n${lines}\n\n_${new Date().toISOString()}_`;

  const sent = await sendAlert(message);
  if (sent) {
    console.log(`[${new Date().toISOString()}] Alert Telegram inviato: ${alerts.length} avviso/i`);
  } else {
    console.error(`[${new Date().toISOString()}] Errore invio alert Telegram`);
  }
}

module.exports = { sendAlert, processAlerts };
