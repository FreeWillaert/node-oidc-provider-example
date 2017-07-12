'use strict';

// see previous example for the things that are not commented
// const assert = require('assert');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

// const Provider = require('oidc-provider');
require('util').promisify = require('util.promisify');
const Provider = require('oidc-provider-node65');

const serverlessHttp = require('serverless-http');

// TODO: require the DynamoDB adapter factory/class
// const DynamoDBAdapter = require('./dynamodb_adapter');
// const MyMemoryAdapter = require('./MyMemoryAdapter');

// simple account model for this application, user list is defined like so
const Account = require('./account');

const oidc = new Provider('http://TOREPLACE', {

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
  interactionUrl(ctx) {
    return `/interaction/${ctx.oidc.uuid}`;
  },

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
    sessionManagement: false,
  },
});

const keystore = require('./keystore.json');
const integrity = require('./integrity.json');


const expressPromise = oidc.initialize({
  keystore,
  integrity,
  clients: [
    // reconfigured the foo client for the purpose of showing the adapter working
    {
      client_id: 'foo',
      // redirect_uris: ['https://example.com'],
      redirect_uris: ['https://jwt.io'],
      response_types: ['id_token token'],
      grant_types: ['implicit'],
      token_endpoint_auth_method: 'none',
    },
  ],
  // configure Provider to use the adapter
  // adapter: MyMemoryAdapter
}).then(() => {
  // TODO: What does proxy setting do??
  oidc.app.proxy = true;

  // TODO: What does keys setting do exactly??
  // oidc.app.keys = process.env.SECURE_KEY.split(',');
  // TEMPORARILY setting fixed values here.
  oidc.app.keys = ['BA029827D9A1806C2F28A441B62D7B44B4F6ECFC78D85CCFD3C9E2989F2677FD', '606999196AB576E99482612FA4373717222D4A6E7F08D8FC85864522302B51C'];
}).then(() => {
  // let's work with express here, below is just the interaction definition
  const expressApp = express();
  expressApp.set('trust proxy', true);
  expressApp.set('view engine', 'ejs');
  expressApp.set('views', path.resolve(__dirname, 'views'));

  const parse = bodyParser.urlencoded({ extended: false });

  expressApp.get('/interaction/:grant', (req, res, next) => {

    console.log("get /interaction/:grant -- start...");

    oidc.interactionDetails(req)
      .then(details => {
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

        return res.render(view, { details });
      })
      .then(data => {
        console.log("get /interaction/:grant -- all done!");
      })
      .catch(next);
  });

  expressApp.post('/interaction/:grant/confirm', parse, (req, res, next) => {
    console.log("post /interaction/:grant/confirm -- start...");

    return oidc.interactionFinished(req, res, {
      consent: {},
    })
      .then(data => {
        console.log("get /interaction/:grant/confirm -- all done!");
      })
      .catch(next);
  });

  expressApp.post('/interaction/:grant/login', parse, (req, res, next) => {

    console.log("get /interaction/:grant/login -- start...");

    return Account.authenticate(req.body.email, req.body.password)
      .then((account) => {

        return oidc.interactionFinished(req, res, {
          login: {
            account: account.accountId,
            acr: '1',
            remember: !!req.body.remember,
            ts: Math.floor(Date.now() / 1000),
          },
          consent: {
            // TODO: remove offline_access from scopes if remember is not checked
          },
        });
      })
      .then(data => {
        console.log("get /interaction/:grant/login -- all done: " + JSON.stringify(data));
      })
      .catch(next);

  });

  // leave the rest of the requests to be handled by oidc-provider, there's a catch all 404 there
  expressApp.use(oidc.callback); //, logResponseBody);

  return expressApp;
});

function getLoggingCallback(originalCallback) {
  return (...callbackParams) => {
    console.log(JSON.stringify(callbackParams));
    originalCallback.apply(null, callbackParams);
  }
}

module.exports.handler = (event, context, callback) => {
  console.log("Handling event:" + JSON.stringify(event, null, 2));

  // TBD: can we still (re)set issuer here?
  oidc.issuer = `${event.isOffline ? 'http' : 'https'}://${event.headers.Host}${event.isOffline ? '' : '/' + event.requestContext.stage}`;

  const loggingCallback = getLoggingCallback(callback);

  expressPromise.then((expressApp) => {
    return serverlessHttp(expressApp, { callbackWaitsForEmptyEventLoop: true })(event, context, loggingCallback);
  })
    .then((data) => {
      console.log("Done! " + JSON.stringify(data));
    })
    ;
};
