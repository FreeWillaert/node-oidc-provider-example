/* eslint-disable */
'use strict';

const assert = require('assert');
const AWS = require("aws-sdk");

function grantKeyFor(id) {
    return `grant:${id}`;
}

class DynamoDBAdapter {

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
        assert(name, 'name must be provided');
        assert(process.env.DYNAMODB_REGION, 'DYNAMODB_REGION env var must be set');
        assert(process.env.DYNAMODB_TABLE, 'DYNAMODB_TABLE env var must be set');

        this.name = name;

        AWS.config.update({ region: process.env.DYNAMODB_REGION });

        this.docClient = new AWS.DynamoDB.DocumentClient({ params: { TableName: process.env.DYNAMODB_TABLE } });
    }

    key(id) {
        return `${this.name}:${id}`;
    }

    putModel(key, payload, expiresIn) {
        const item = Object.assign({ key: key }, payload);

        if (expiresIn) {
            item.expiration = (Date.now() / 1000) + expiresIn;
        }

        return this.docClient.put({ TableName: this.table, Item: item }).promise()
            .then(putResult => {
                console.log("Added item:", JSON.stringify(putResult, null, 2));
            });
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
         * Hint: you can JSON.parse(base64decode( ... )) the header and payload to get the token
         * properties and store them too, they may be helpful for getting insights on your usage.
         * Modifying any of header, payload or signature values will result in the token being invalid,
         * remember that oidc-provider will do a JWT signature check of both the received and stored
         * token to detect potential manipulation.
         *
         * Hint2: in order to fulfill all OAuth2.0 behaviors in regards to invalidating and expiring
         * potentially misused or sniffed tokens you should keep track of all tokens that belong to the
         * same grantId.
         *
         * Client model will only use this when registered through Dynamic Registration features.
         *
         * Session model payload contains the following properties:
         * - account {string} the session account identifier
         * - authorizations {object} object with session authorized clients and their session identifiers
         * - loginTs {number} timestamp of user's authentication
         *
         */

        const key = this.key(id);

        const promises = [];

        const grantId = payload.grantId;
        if (grantId) {
            const grantKey = grantKeyFor(grantId);
            const handleGrantPromise = this.docClient.get({ Key: { key: grantKey } }).promise()
                .then(grant => {
                    if (!grant) {
                        return putModel(grantKey, [key]);
                    } else {
                        grant.push(key);
                        return putModel(grantKey, grant);
                    }
                });
            promises.push(handleGrantPromise);
        }

        promises.push(this.putModel(key, payload, expiresIn));

        return Promise.all(promises);
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
        const key = this.key(id);
        return this.docClient.get({ Key: { key: key } }).promise()
            .then(getResult => {
                console.log("Retrieved item:", JSON.stringify(getResult, null, 2));
            })
            .catch(error => {
                console.error("Error:" + error);
                throw error;
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
        const key = this.key(id);
        return this.docClient.get({ Key: { key: key } }).promise()
            .then(model => {
                model.consumed = Date.now() / 1000;
                return putModel(key, model);
            });
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

        /**
         *
         * See upsert for the note on grantId, it's imperitive to destroy all tokens with the same
         * grantId when destroy is called. To query your persistancy store for the grantId of this token
         * and also trigger a chain of removals for all related tokens is recommended.
         *
         */

        const key = this.key(id);

        return this.docClient.get({ Key: { key: key } }).promise()
            .then(model => {

                var promises = [];

                if (model && model.grantId) {
                    const grantKey = grantKeyFor(grantId);
                    this.docClient.get({ Key: { key: grantKey } }).promise()
                        .then(tokenKeys => {
                            tokenKeys.forEach(tokenKey => {
                                promises.push(this.docClient.delete({ Key: { key: tokenKey } }));
                            })
                        };
                }

                promises.push(this.docClient.delete({ Key: { key: key } }));

                // TODO: Check FSK: shouldn't the model with key == grantKey not also be deleted??

                return Promise.all(promises);
            })

    }
}

module.exports = DynamoDBAdapter;
