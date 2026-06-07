const { execFileSync } = require('child_process');
const path = require('path');

const config = require(path.join(__dirname, '..', '..', 'config', 'default.json'));

function queryGpus(query) {
  const nvidiaSmi = config.nvidia?.nvidiaSmiPath || '/usr/bin/nvidia-smi';
  const output = execFileSync(nvidiaSmi, ['--query-gpu=' + query, '--format=csv,noheader,nounits']).toString().trim();
  const lines = output.split('\n').filter(l => l.trim() !== '');
  return lines.map(l => l.trim());
}

function collect() {
  const names = queryGpus('name');
  const temps = queryGpus('temperature.gpu');
  const memUsed = queryGpus('memory.used');
  const memTotal = queryGpus('memory.total');
  const memFree = queryGpus('memory.free');
  const utilGpu = queryGpus('utilization.gpu');
  const utilMem = queryGpus('utilization.memory');
  const powerDraw = queryGpus('power.draw');
  const powerLimit = queryGpus('power.limit');

  const gpus = names.map((name, i) => {
    const memUsedNum = parseFloat(memUsed[i]) || 0;
    const memTotalNum = parseFloat(memTotal[i]) || 1;
    return {
      name,
      temperature: parseFloat(temps[i]) || 0,
      memory: {
        used: Math.round(memUsedNum),
        total: Math.round(memTotalNum),
        free: Math.round(parseFloat(memFree[i]) || 0),
        usedPct: parseFloat(((memUsedNum / memTotalNum) * 100).toFixed(1))
      },
      utilization: {
        gpu: parseFloat(utilGpu[i]) || 0,
        memory: parseFloat(utilMem[i]) || 0
      },
      power: {
        draw: parseFloat(powerDraw[i]) || 0,
        limit: parseFloat(powerLimit[i]) || 0
      }
    };
  });

  return { timestamp: new Date().toISOString(), gpus };
}

function getAlerts(data) {
  const alerts = [];
  const vramThreshold = config.alerts?.vramThresholdPct || 85;
  const tempThreshold = config.alerts?.p40TempThresholdC || 75;

  for (const gpu of data.gpus) {
    if (gpu.memory.usedPct > vramThreshold) {
      alerts.push({
        level: 'critical',
        source: gpu.name,
        metric: 'vram',
        value: gpu.memory.usedPct,
        threshold: vramThreshold,
        message: `VRAM ${gpu.name}: ${gpu.memory.usedPct}% (${gpu.memory.used}/${gpu.memory.total} MiB) > ${vramThreshold}%`
      });
    }
    if (gpu.temperature > tempThreshold) {
      alerts.push({
        level: 'warning',
        source: gpu.name,
        metric: 'temperature',
        value: gpu.temperature,
        threshold: tempThreshold,
        message: `Temp ${gpu.name}: ${gpu.temperature}°C > ${tempThreshold}°C`
      });
    }
  }

  return alerts;
}

module.exports = { collect, getAlerts };
