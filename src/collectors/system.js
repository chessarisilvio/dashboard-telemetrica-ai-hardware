const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getCpuInfo() {
  const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf-8');
  const lines = cpuinfo.split('\n');
  const modelMatch = lines.find(l => l.startsWith('model name'));
  const cpuCount = lines.filter(l => l.startsWith('processor')).length;
  const model = modelMatch ? modelMatch.split(':')[1].trim() : 'Unknown CPU';

  const loadavg = fs.readFileSync('/proc/loadavg', 'utf-8').trim().split(' ');
  const load1 = parseFloat(loadavg[0]);
  const load5 = parseFloat(loadavg[1]);
  const load15 = parseFloat(loadavg[2]);
  const loadPct = parseFloat(((load1 / cpuCount) * 100).toFixed(1));

  return { model, cores: cpuCount, load: { load1, load5, load15, loadPct } };
}

function getMemoryInfo() {
  const output = execSync('free -m').toString().trim();
  const lines = output.split('\n');
  const memLine = lines.find(l => l.startsWith('Mem:'));
  const parts = memLine.split(/\s+/);

  return {
    total: parseInt(parts[1]),
    used: parseInt(parts[2]),
    free: parseInt(parts[3]),
    available: parseInt(parts[6]),
    usedPct: parseFloat(((parseInt(parts[2]) / parseInt(parts[1])) * 100).toFixed(1))
  };
}

function getDiskInfo() {
  const output = execSync('df -h /').toString().trim().split('\n');
  const parts = output[1].split(/\s+/);
  return {
    filesystem: parts[0],
    size: parts[1],
    used: parts[2],
    available: parts[3],
    usedPct: parseInt(parts[4].replace('%', ''))
  };
}

function getUptime() {
  const output = execSync('uptime -s').toString().trim();
  const bootTime = new Date(output);
  const now = new Date();
  const uptimeMs = now - bootTime;
  const days = Math.floor(uptimeMs / 86400000);
  const hours = Math.floor((uptimeMs % 86400000) / 3600000);
  const minutes = Math.floor((uptimeMs % 3600000) / 60000);
  return { bootTime: output, uptime: { days, hours, minutes } };
}

function getJournalLines(n) {
  n = n || 50;
  try {
    const output = execSync(`journalctl --no-pager -n ${n} --no-full`, { encoding: 'utf-8' });
    const lines = output.split('\n').filter(l => l.trim() !== '');
    return lines.slice(-n);
  } catch (e) {
    return [`Errore lettura journal: ${e.message}`];
  }
}

function getRunningServices() {
  try {
    const output = execSync('systemctl list-units --type=service --state=running --no-pager --no-legend', { encoding: 'utf-8' });
    const lines = output.split('\n').filter(l => l.trim() !== '');
    return lines.map(l => {
      const parts = l.trim().split(/\s+/);
      return {
        name: parts[0],
        loadState: parts[1],
        activeState: parts[2],
        sub: parts[3],
        description: parts.slice(4).join(' ')
      };
    });
  } catch (e) {
    return [];
  }
}

function collect() {
  return {
    timestamp: new Date().toISOString(),
    cpu: getCpuInfo(),
    memory: getMemoryInfo(),
    disk: getDiskInfo(),
    uptime: getUptime()
  };
}

module.exports = { collect, getCpuInfo, getMemoryInfo, getDiskInfo, getUptime, getJournalLines, getRunningServices };
