const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const CONFIG = require('../../config');

const adapter = new FileSync(`${CONFIG.paths.database}/data.json`, { defaultValue: { releases: [] } });
const db = low(adapter);

module.exports = db;
