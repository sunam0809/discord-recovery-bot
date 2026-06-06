const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    const initial = { verifiedUsers: {}, recoveryKeys: {}, guildSettings: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function save(data) {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = {
  getVerifiedUsers(guildId) {
    const data = load();
    return data.verifiedUsers[guildId] || [];
  },

  addVerifiedUser(guildId, userId, accessToken, refreshToken) {
    const data = load();
    if (!data.verifiedUsers[guildId]) data.verifiedUsers[guildId] = [];
    const existing = data.verifiedUsers[guildId].findIndex(u => u.userId === userId);
    const entry = { userId, accessToken, refreshToken, verifiedAt: new Date().toISOString() };
    if (existing >= 0) {
      data.verifiedUsers[guildId][existing] = entry;
    } else {
      data.verifiedUsers[guildId].push(entry);
    }
    save(data);
  },

  getGuildSettings(guildId) {
    const data = load();
    return data.guildSettings[guildId] || null;
  },

  setGuildSettings(guildId, settings) {
    const data = load();
    data.guildSettings[guildId] = settings;
    save(data);
  },

  createRecoveryKey(guildId) {
    const data = load();
    if (!data.recoveryKeys) data.recoveryKeys = {};
    const key = require('uuid').v4().replace(/-/g, '').substring(0, 20).toUpperCase();
    data.recoveryKeys[key] = { guildId, createdAt: new Date().toISOString(), used: false };
    save(data);
    return key;
  },

  useRecoveryKey(key) {
    const data = load();
    if (!data.recoveryKeys) return null;
    const entry = data.recoveryKeys[key];
    if (!entry || entry.used) return null;
    data.recoveryKeys[key].used = true;
    save(data);
    return entry;
  },
};
