'use strict';

const _ = require('lodash');
const assert = require('assert');
const base64url = require('base64url');
const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies

_.mixin(require('lodash-inflection'));

const dynamo = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

function unix() {
  return new Date() / 1000 | 0; // eslint-disable-line no-bitwise
}

function dropQuery(TableName, id) {
  return dynamo.delete({
    TableName,
    Key: { id },
  }).promise();
}

function indexQuery(TableName, grantId) {
  return dynamo.query({
    TableName,
    IndexName: 'grantId-index',
    KeyConditions: { grantId: { ComparisonOperator: 'EQ', AttributeValueList: [grantId] } },
  }).promise();
}

const resolved = Promise.resolve();
const rejected = Promise.reject(new Error('noop called, why?!'));

const noop = {
  upsert() {
    return rejected;
  },
  find() {
    return resolved;
  },
  consume() {
    return rejected;
  },
  destroy() {
    return rejected;
  },
};

const adapters = [
  'AccessToken',
  'AuthorizationCode',
  'ClientCredentials',
  'RefreshToken',
  'Session',
  'Client',
  'RegistrationAccessToken',
  'InitialAccessToken',
];

class DynamoAdapter {
  constructor(name) {
    if (adapters.indexOf(name) === -1) return noop;

    const table = _.chain(name)
      .pluralize()
      .snakeCase()
      .toUpper()
      .value();

    const envName = `${table}_TABLE_NAME`;

    this.TableName = process.env[envName];
    assert(this.TableName, `expected process.env.${envName} variable to be present`);
  }

  upsert(id, payload, expiresIn) {
    const expiresAt = (() => {
      if (!expiresIn) return undefined;
      return new Date(Date.now() + (expiresIn * 1000)) / 1000 | 0; // eslint-disable-line no-bitwise
    })();

    const Item = Object.assign(payload, { id, expiresAt });

    if (Item.header) Item.rawHeader = JSON.parse(base64url.decode(Item.header));
    if (Item.payload) Item.rawPayload = JSON.parse(base64url.decode(Item.payload));

    return dynamo.put({
      TableName: this.TableName,
      Item,
    }).promise();
  }

  find(id) {
    return dynamo.get({
      TableName: this.TableName,
      Key: { id },
    }).promise().then((result) => {
      if (result.Item) {
        if (!result.Item.expiresAt || result.Item.expiresAt > unix()) {
          return result.Item;
        }
      }

      return undefined;
    });
  }

  consume(id) {
    return dynamo.update({
      TableName: this.TableName,
      Key: { id },
      UpdateExpression: 'set #property = :value',
      ExpressionAttributeNames: { '#property': 'consumed' },
      ExpressionAttributeValues: { ':value': unix() },
    }).promise();
  }

  destroy(id) {
    return dynamo.delete({
      TableName: this.TableName,
      Key: { id },
    }).promise();
  }

  static revoke(grantId) {
    return Promise.all([
      indexQuery(process.env.ACCESS_TOKENS_TABLE_NAME, grantId),
      indexQuery(process.env.AUTHORIZATION_CODES_TABLE_NAME, grantId),
      indexQuery(process.env.REFRESH_TOKENS_TABLE_NAME, grantId),
    ]).then((res) => {
      res[0].Items.forEach((token) => {
        dropQuery(process.env.ACCESS_TOKENS_TABLE_NAME, token.id);
      });
      res[1].Items.forEach((token) => {
        dropQuery(process.env.AUTHORIZATION_CODES_TABLE_NAME, token.id);
      });
      res[2].Items.forEach((token) => {
        dropQuery(process.env.REFRESH_TOKENS_TABLE_NAME, token.id);
      });
    });
  }
}

module.exports = DynamoAdapter;
