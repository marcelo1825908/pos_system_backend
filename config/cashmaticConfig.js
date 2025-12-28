const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'cashmaticConfig.json');

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      // Defaults tailored for Musti: ip + credentials
      return {
        ip: '192.168.1.58',
        username: 'cp',
        password: '1235',
      };
    }
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const json = JSON.parse(raw);
    return {
      ip: json.ip || '192.168.1.58',
      username: json.username || 'cp',
      password: json.password || '1235',
    };
  } catch (err) {
    console.error('Error reading Cashmatic config:', err);
    return {
      ip: '192.168.1.58',
      username: 'cp',
      password: '1235',
    };
  }
}

module.exports = { readConfig };
