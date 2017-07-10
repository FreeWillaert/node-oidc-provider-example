"use strict";

const handler = require("./src/index");

const event1 = {
    "headers": {
        "Host": "localhost:3000"
    },
    "path": "/.well-known/openid-configuration",
    "pathParameters": {
        "proxy": ".well-known/openid-configuration"
    },
    "requestContext": {
        "stage": "dev"
    },
    "resource": "/{proxy*}",
    "httpMethod": "GET",
    "queryStringParameters": null,
    "body": null,
    "isOffline": true
};


const event2 = {
    "headers": {
        "Host": "denhost"
    },
    "path": "/auth",
    "pathParameters": {
        "proxy": "auth"
    },
    "requestContext": {
        "stage": "dev"
    },
    "resource": "/{proxy*}",
    "httpMethod": "GET",
    "queryStringParameters": {
        "client_id": "foo",
        "response_type": "id_token token",
        "scope": "openid email",
        "prompt": "login",
        "nonce": "tarara7"
    },
    "body": null,
    "isOffline": true
};

const event = event2;
const context = {};
handler.handler(event, context, function (error, result) {
    if (error) {
        console.error(error);
        return;
    }
    console.log(JSON.stringify(result));
});