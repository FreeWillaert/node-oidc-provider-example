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
// process.env.DYNAMODB_REGION = "eu-central-1"; // TODO: read this from serverless.yml region, or set it as environment variable there
// process.env.DYNAMODB_TABLE = "oidc-provider-models";
const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies
AWS.config.update({ region: "eu-central-1" }); // TODO: read this from serverless.yml region, or set it as environment variable there
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
  },
});

const keystore = require('./keystore.json');
const integrity = require('./integrity.json');

const expressApp = express();

var expressPromise = oidc.initialize({
  keystore,
  integrity,
  clients: [
    {
      client_id: 'foo',
      redirect_uris: ['https://example.com'],
      response_types: ['id_token token'],
      grant_types: ['implicit'],
      token_endpoint_auth_method: 'none',
    },
  ],
}).then(() => {

  // TODO: What does proxy setting do?? also check oidc.app.secure ?
  oidc.app.proxy = true;

  // TODO: What does keys setting do??
  // oidc.app.keys = process.env.SECURE_KEY.split(',');
  // TEMPORARILY setting fixed values here.
  oidc.app.keys = ["BA029827D9A1806C2F28A441B62D7B44B4F6ECFC78D85CCFD3C9E2989F2677FD", "606999196AB576E99482612FA4373717222D4A6E7F08D8FC85864522302B51C"];

  DynamoAdapter.revoke.bind(DynamoAdapter)();

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

  oidc.issuer = `${event.isOffline ? "http" : "https"}://${event.headers.Host}${event.isOffline ? "" : "/" + event.requestContext.stage}`;
  console.log("oidc:" + JSON.stringify(oidc));

  expressPromise.then((expressApp) => {
    serverlessHttp(expressApp)(event, context, callback);
  })
}
