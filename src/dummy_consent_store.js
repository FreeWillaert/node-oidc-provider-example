'use strict';

var fs = require('fs');

const STORE_PATH = './temp/consents.json';

function get(accountId) {
    if(!fs.existsSync(STORE_PATH)) {
        fs.writeFileSync(STORE_PATH, JSON.stringify({}));
    }
    const store = JSON.parse(fs.readFileSync(STORE_PATH));
    return store[accountId];
}

function set(accountId, value) {
    const store = JSON.parse(fs.readFileSync(STORE_PATH));
    store[accountId] = value;
    fs.writeFileSync(STORE_PATH, JSON.stringify(store));
}

module.exports = {get, set}
