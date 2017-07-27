'use strict';

const assert = require('assert');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const serverlessHttp = require('serverless-http');

const Provider = require('oidc-provider');

// simple account model for this application, user list is defined like so
const Account = require('./account');

// require the DynamoDB adapter factory/class
const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies
const DynamoAdapter = require('./dynamo_adapter');

const oidc = new Provider("http://TOREPLACE", { // The issuer will be set in the handler.

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

  adapter: DynamoAdapter,

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
    oauthNativeApps: true,
    pkce: {
      skipClientAuth: true
    }
  },
});

const keystore = require('./keystore.json');
const integrity = require('./integrity.json');

const expressApp = express();

var expressPromise = oidc.initialize({
  keystore,
  integrity,
  clients: [
    // Browser-based client
    {
      client_id: 'foo',
      redirect_uris: ['https://example.com'],
      response_types: ['id_token token'],
      grant_types: ['implicit'],
      token_endpoint_auth_method: 'none',
    },
    // Web client
    {
      client_id: 'foo2',
      client_secret: 'bar2',
      redirect_uris: ['https://demo.c2id.com/oidc-client/cb'],
      response_types: ['code'],
      grant_types: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'client_secret_basic',
    },
    // Mobile client with pkce
    {
      application_type: 'native',
      client_id: 'foo3',
      client_name: 'My Mobile Client',
      client_secret: 'dummy',
      redirect_uris: ['https://demo.c2id.com/oidc-client/cb'],
      response_types: ['code'],
      grant_types: ['authorization_code'], // Assume: no refresh token for native app...?
      // token_endpoint_auth_method: 'none', // No password needed on token endpoint! -- in current version this doesn't work yet - cannot combine grant type authorization code wwith auth method none on token endpoint!
    },
  ],
}).then(() => {

  oidc.app.proxy = true;
  // oidc.app.secure = false; // TESTING

  oidc.app.keys = process.env.COOKIE_KEYS.split(',');

  oidc.on('grant.revoked', DynamoAdapter.revoke.bind(DynamoAdapter));

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

  return expressApp;
});


module.exports.handler = (event, context, callback) => {

  // const myCallback = function (error, result) {
  //   // It seems (???) that serverless-offline cannot handle multiple headers of which the name only differs by casing, such as the set-cookie headers generated by express.

  //   if (event.isOffline) {
  //     const headers = result.headers;

  //     // var singleCookieHeaderValue = "";
  //     // var i = 0;

  //     for (var header in headers) {
  //       if (header.toLowerCase() !== "set-cookie") continue;

  //       // singleCookieHeaderValue += headers[header] + ';,';
  //       // headers[header+(++i)] = headers[header];
  //       headers[header.toUpperCase()] = headers[header];
  //       delete headers[header];
  //     }

  //     // if(singleCookieHeaderValue.length > 0) {
  //     //   headers['set-cookie'] = singleCookieHeaderValue;
  //     // }
  //   }

  //   callback(error, result);
  // }

  console.log("HANDLING EVENT:" + JSON.stringify(event, null, 2));

  if (!context.callbackWaitsForEmptyEventLoop) console.warn("!!! callbackWaitsForEmptyEventLoop IS FALSE !!!");

  oidc.issuer = `${event.isOffline ? "http" : "https"}://${event.headers.Host}`;

  expressPromise.then((expressApp) => {


    // Skip favicon requests. Note: it is better to avoid favicon.ico requests being made.
    if (event.path === "/favicon.ico") return callback(null, { statusCode: 200, body: "" });

    serverlessHttp(expressApp)(event, context, callback);
  });
}
