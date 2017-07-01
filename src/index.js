'use strict';

// see previous example for the things that are not commented
const assert = require('assert');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const serverlessHttp = require('serverless-http');

const Provider = require('oidc-provider');

// assert(process.env.HEROKU_APP_NAME, 'process.env.HEROKU_APP_NAME missing, run `heroku labs:enable runtime-dyno-metadata`');
// assert(process.env.PORT, 'process.env.PORT missing');
// assert(process.env.SECURE_KEY, 'process.env.SECURE_KEY missing, run `heroku addons:create securekey`');
// assert.equal(process.env.SECURE_KEY.split(',').length, 2, 'process.env.SECURE_KEY format invalid');
// assert(process.env.REDIS_URL, 'process.env.REDIS_URL missing, run `heroku-redis:hobby-dev`');

// simple account model for this application, user list is defined like so
const Account = require('./account');

// const oidc = new Provider(`https://${process.env.HEROKU_APP_NAME}.herokuapp.com`, {
// TODO: Read host from incoming event?
const oidc = new Provider('http://localhost:3000', {

  // oidc-provider only looks up the accounts by their ID when it has to read the claims,
  // passing it our Account model method is sufficient, it should return a Promise that resolves
  // with an object with accountId property and a claims method.
  findById: Account.findById,

  // let's tell oidc-provider we also support the email scope, which will contain email and
  // email_verified claims
  claims: {
    // scope: [claims] format
    openid: ['sub'],
    email: ['email', 'email_verified'],
  },

  // let's tell oidc-provider where our own interactions will be
  // setting a nested route is just good practice so that users
  // don't run into weird issues with multiple interactions open
  // at a time.
  interactionUrl() {
    // this => oidc koa request context;
    return `/interaction/${this.oidc.uuid}`;
  },

  // Note: using generic in-memory adapter

  features: {
    // disable the packaged interactions
    devInteractions: false,

    claimsParameter: true,
    clientCredentials: true,
    discovery: true,
    encryption: true,
    introspection: true,
    registration: true,
    request: true,
    requestUri: true,
    revocation: true,
    sessionManagement: true,
  },
});

const keystore = require('./keystore.json');
const integrity = require('./integrity.json');

const expressApp = express();

var expressPromise = oidc.initialize({
  keystore,
  integrity,
  clients: [
    // reconfigured the foo client for the purpose of showing the adapter working
    {
      client_id: 'foo',
      redirect_uris: ['https://example.com'],
      response_types: ['id_token token'],
      grant_types: ['implicit'],
      token_endpoint_auth_method: 'none',
    },
  ],
}).then(() => {

  console.error("TUUUT");

  // TODO: What is proxy?
  oidc.app.proxy = true;

  // TODO: What to do about keys??
  // oidc.app.keys = process.env.SECURE_KEY.split(',');
  oidc.app.keys = ["abc", "def"]
}).then(() => {

  expressApp.set('trust proxy', true);
  expressApp.set('view engine', 'ejs');
  expressApp.set('views', path.resolve(__dirname, 'views'));

  const parse = bodyParser.urlencoded({ extended: false });

  expressApp.get('/interaction/:grant', (req, res) => {
    const details = oidc.interactionDetails(req);
    console.log('see what else is available to you for interaction views', details);

    const view = (() => {
      switch (details.interaction.reason) {
        case 'consent_prompt':
        case 'client_not_authorized':
          return 'interaction';
        default:
          return 'login';
      }
    })();

    res.render(view, { details });
  });

  expressApp.post('/interaction/:grant/confirm', parse, (req, res) => {
    oidc.interactionFinished(req, res, {
      consent: {},
    });
  });

  expressApp.post('/interaction/:grant/login', parse, (req, res, next) => {
    Account.authenticate(req.body.email, req.body.password).then((account) => {
      oidc.interactionFinished(req, res, {
        login: {
          account: account.accountId,
          acr: '1',
          remember: !!req.body.remember,
          ts: Math.floor(Date.now() / 1000),
        },
        consent: {
          // TODO: remove offline_access from scopes is remember is not checked
        },
      });
    }).catch(next);
  });

  // leave the rest of the requests to be handled by oidc-provider, there's a catch all 404 there
  expressApp.use(oidc.callback);

  // express listen
  // expressApp.listen(process.env.PORT);

  return expressApp;
});


module.exports.handler = (event, context, callback) => {
  // TODO: distinguish based on oidc.initialized...??

  expressPromise.then((expressApp) => {
    serverlessHttp(expressApp)(event, context, callback);
  })
}
