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

function dropQuery(tableName, id) {
  return dynamo.delete({
    TableName: tableName,
    Key: { id },
  }).promise();
}

function indexQuery(tableName, grantId) {
  return dynamo.query({
    TableName: tableName,
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

  /**
   *
   * Creates an instance of MyAdapter for an oidc-provider model.
   *
   * @constructor
   * @param {string} name Name of the oidc-provider model. One of "Session", "AccessToken",
   * "AuthorizationCode", "RefreshToken", "ClientCredentials" or "Client", "InitialAccessToken",
   * "RegistrationAccessToken"
   *
   */
  constructor(name) {
    if (adapters.indexOf(name) === -1) return noop;

    const table = _.chain(name)
      .pluralize()
      .snakeCase()
      .toUpper()
      .value();

    const envName = `${table}_TABLE_NAME`;

    this.tableName = process.env[envName];
    assert(this.tableName, `expected process.env.${envName} variable to be present`);
  }

  /**
   *
   * Update or Create an instance of an oidc-provider model.
   *
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   * @param {string} id Identifier that oidc-provider will use to reference this model instance for
   * future operations.
   * @param {object} payload Object with all properties intended for storage.
   * @param {expiresIn} integer Number of seconds intended for this model to be stored.
   *
   */
  upsert(id, payload, expiresIn) {
    /**
     * 
     * When this is one of AccessToken, AuthorizationCode, RefreshToken, ClientCredentials,
     * InitialAccessToken or RegistrationAccessToken the payload will contain the following
     * properties:
     * - grantId {string} the original id assigned to a grant (authorization request)
     * - header {string} oidc-provider tokens are themselves JWTs, this is the header part of the token
     * - payload {string} second part of the token
     * - signature {string} the signature of the token
     *
     * Client model will only use this when registered through Dynamic Registration features.
     *
     * Session model payload contains the following properties:
     * - account {string} the session account identifier
     * - authorizations {object} object with session authorized clients and their session identifiers
     * - loginTs {number} timestamp of user's authentication
     *
     */

    const expiresAt = expiresIn
      ? Math.floor((Date.now() / 1000) + expiresIn)
      : undefined;

    const item = Object.assign(payload, { id, expiresAt });

    // Optional: Store parsed header and payload to gain insights on usage.
    if (item.header) item.rawHeader = JSON.parse(base64url.decode(item.header));
    if (item.payload) item.rawPayload = JSON.parse(base64url.decode(item.payload));

    return dynamo.put({
      TableName: this.tableName,
      Item: item
    }).promise();
  }

  /**
   *
   * Return previously stored instance of an oidc-provider model.
   *
   * @return {Promise} Promise fulfilled with either Object (when found and not dropped yet due to
   * expiration) or falsy value when not found anymore. Rejected with error when encountered.
   * @param {string} id Identifier of oidc-provider model
   *
   */
  find(id) {
    return dynamo.get({
      TableName: this.tableName,
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

  /**
   * 
   * Mark a stored oidc-provider model as consumed (not yet expired though!). Future finds for this
   * id should be fulfilled with an object containing additional property named "consumed".
   *
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   * @param {string} id Identifier of oidc-provider model
   *
   */
  consume(id) {
    return dynamo.update({
      TableName: this.tableName,
      Key: { id },
      UpdateExpression: 'set #property = :value',
      ExpressionAttributeNames: { '#property': 'consumed' },
      ExpressionAttributeValues: { ':value': unix() },
    }).promise();
  }

  /**
   *
   * Destroy/Drop/Remove a stored oidc-provider model and other grant related models. Future finds
   * for this id should be fulfilled with falsy values.
   *
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   * @param {string} id Identifier of oidc-provider model
   *
   */
  destroy(id) {
    return dynamo.delete({
      TableName: this.tableName,
      Key: { id },
    }).promise();
  }

  /**
   * Remove all tokens that belong to the same grantId, in order to fulfill all OAuth2.0 
   * behaviors in regards to invalidating and expiring potentially misused or sniffed tokens.
   * 
   * This may be triggered by
   *    oidc.on('grant.revoked', Adapter.revoke.bind(Adapter)); 
   * 
   * TODO: Since serverless-http sets callbackWaitsForEmptyEventLoop to false, there is no guarantee that the revoke will be executed!
   */
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
