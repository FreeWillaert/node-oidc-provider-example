'use strict';

const LRU = require('lru-cache');
const epochTime = require('./MyEpochTime');

const storage = new LRU({});

function grantKeyFor(id) {
  console.log("MyMemoryAdapter start function grantKeyFor:" + JSON.stringify({ id: id }));
  return `grant:${id}`;
}

class MyMemoryAdapter {
  constructor(name) {
    console.log("MyMemoryAdapter start constructor:" + JSON.stringify({ name: name }));
    this.name = name;
  }

  key(id) {
    // console.log("MyMemoryAdapter start key:" + JSON.stringify({ id: id }));
    const key = `${this.name}:${id}`;
    console.log("MyMemoryAdapter returning key:" + JSON.stringify({ name: this.name, id: id, key: key }));
    return key;
  }

  destroy(id) {
    console.log("MyMemoryAdapter start destroy:" + JSON.stringify({ name: this.name, id: id }));
    const key = this.key(id);
    const grantId = storage.get(key) && storage.get(key).grantId;

    storage.del(key);

    if (grantId) {
      const grantKey = grantKeyFor(grantId);

      storage.get(grantKey).forEach(token => storage.del(token));
    }

    return Promise.resolve();
  }

  consume(id) {
    console.log("MyMemoryAdapter start consume:" + JSON.stringify({ name: this.name, id: id }));

    storage.get(this.key(id)).consumed = epochTime();
    return Promise.resolve();
  }

  find(id) {
    console.log("MyMemoryAdapter start find:" + JSON.stringify({ name: this.name, id: id }));

    const key = this.key(id);

    var data;

    // TESTING
    if (key === "Session:b7b7e885-d11c-451b-bc40-5192a53504f1") {
      data = {
        "returnTo": "https://denhost/auth/b7b7e885-d11c-451b-bc40-5192a53504f1",
        "interaction": {
          "error": "login_required",
          "error_description": "End-User authentication is required",
          "reason": "no_session",
          "reason_description": "Please Sign-in to continue."
        },
        "uuid": "b7b7e885-d11c-451b-bc40-5192a53504f1",
        "params": {
          "client_id": "foo",
          "nonce": "tarara7",
          "prompt": "login",
          "redirect_uri": "https://jwt.io",
          "response_mode": "fragment",
          "response_type": "id_token token",
          "scope": "openid email"
        }
      };

      // TODO: Can result also be added for event3 ??
      data.result = {
        "login": {
          "account": "23121d3c-84df-44ac-b458-3d63a9a05497",
          "acr": "1",
          "remember": true,
          "ts": 1499885223
        },
        "consent": {}
      };

      return Promise.resolve(data);
    }
    if (id === "b7b7e885-d11c-451b-bc40-5192a53504f1") {
      data = {
        "returnTo": "https://denhost/auth/b7b7e885-d11c-451b-bc40-5192a53504f1",
        "interaction": {
          "error": "login_required",
          "error_description": "End-User authentication is required",
          "reason": "no_session",
          "reason_description": "Please Sign-in to continue."
        },
        "uuid": "b7b7e885-d11c-451b-bc40-5192a53504f1",
        "params": {
          "client_id": "foo",
          "nonce": "tarara7",
          "prompt": "login",
          "redirect_uri": "https://jwt.io",
          "response_mode": "fragment",
          "response_type": "id_token token",
          "scope": "openid email"
        }
      };

      return Promise.resolve(data);
    }

    data = storage.get(key);
    console.log("MyMemoryAdapter end find:" + JSON.stringify({ name: this.name, id: id, data: data }));
    return Promise.resolve(data);
  }

  upsert(id, payload, expiresIn) {
    console.log("MyMemoryAdapter start upsert:" + JSON.stringify({ name: this.name, id: id, payload: payload, expiresIn: expiresIn }));
    const key = this.key(id);

    const { grantId } = payload;
    if (grantId) {
      const grantKey = grantKeyFor(grantId);
      const grant = storage.get(grantKey);
      if (!grant) {
        storage.set(grantKey, [key]);
      } else {
        grant.push(key);
      }
    }

    storage.set(key, payload, expiresIn * 1000);

    return Promise.resolve();
  }

  static connect(provider) {// eslint-disable-line no-unused-vars
    console.log("MyMemoryAdapter start connect:" + JSON.stringify({ provider: provider }));
    // noop
  }
}

module.exports = MyMemoryAdapter;