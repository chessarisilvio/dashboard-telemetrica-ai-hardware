const fs = require('fs');
const path = require('path');

const HWMON_BASE = '/sys/class/hwmon';

function readHwmonValue(hwmonName, attr) {
  try {
    const hwmonPath = path.join(HWMON_BASE, hwmonName);
    const value = fs.readFileSync(path.join(hwmonPath, attr), 'utf-8').trim();
    return parseInt(value, 10);
  } catch {
    return null;
  }
}

function readHwmonName(hwmonName) {
  try {
    return fs.readFileSync(path.join(HWMON_BASE, hwmonName, 'name'), 'utf-8').trim();
  } catch {
    return hwmonName;
  }
}

function collect() {
  const hwmons = fs.readdirSync(HWMON_BASE).filter(d => d.startsWith('hwmon'));
  const result = [];

  for (const hwmon of hwmons) {
    const name = readHwmonName(hwmon);
    const fans = {};

    for (let i = 1; i <= 10; i++) {
      const input = readHwmonValue(hwmon, `fan${i}_input`);
      if (input !== null) {
        fans[`fan${i}`] = {
          rpm: input,
          min: readHwmonValue(hwmon, `fan${i}_min`) || 0,
          target: readHwmonValue(hwmon, `fan${i}_target`)
        };
      }
    }

    if (Object.keys(fans).length > 0) {
      result.push({ name, hwmon, fans });
    }
  }

  return { timestamp: new Date().toISOString(), hwmons: result };
}

module.exports = { collect };
