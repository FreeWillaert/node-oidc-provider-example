'use strict';

const assert = require('assert');
const Provider = require('oidc-provider');

assert(process.env.HEROKU_APP_NAME, 'process.env.HEROKU_APP_NAME missing, run `heroku labs:enable runtime-dyno-metadata`');
assert(process.env.PORT, 'process.env.PORT missing');
assert(process.env.SECURE_KEY, 'process.env.SECURE_KEY missing, run `heroku addons:create securekey`');
assert.equal(process.env.SECURE_KEY.split(',').length, 2, 'process.env.SECURE_KEY format invalid');

// new Provider instance with no extra configuration, will run in default, just needs the issuer
// identifier, uses data from runtime-dyno-metadata heroku here
const oidc = new Provider(`https://${process.env.HEROKU_APP_NAME}.herokuapp.com`);

// initialize with no keystores, dev ones will be provided
oidc.initialize({
  // just a foobar client to be able to start an Authentication Request
  clients: [{ client_id: 'foo', client_secret: 'bar', redirect_uris: ['http://lvh.me/cb'] }],
}).then(() => {
  // Heroku has a proxy in front that terminates ssl, you should trust the proxy.
  oidc.app.proxy = true;

  // set the cookie signing keys (securekey plugin is taking care of those)
  oidc.app.keys = process.env.SECURE_KEY.split(',');

  // listen on the heroku generated port
  oidc.app.listen(process.env.PORT);
});
