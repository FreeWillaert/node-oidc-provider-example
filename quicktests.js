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

// get login form
const event3 = {
    "headers": {
        "Host": "denhost",
        "Cookie": "_grant=b7b7e885-d11c-451b-bc40-5192a53504f1; _grant.sig=qNOBMpCTqhKdsASR4mi08F0RsYo; _session=52783fc5-e422-403a-b01f-99d1215be90d; _session.sig=IvZpq7PKkNllGmWXhVRnpFsG2Po",
    },
    "path": "/interaction/b7b7e885-d11c-451b-bc40-5192a53504f1",
    "pathParameters": {
        "proxy": "interaction/b7b7e885-d11c-451b-bc40-5192a53504f1"
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

// submit login form
const event4 = {
    "headers": {
        "Host": "denhost",
        "Cookie": "_grant=b7b7e885-d11c-451b-bc40-5192a53504f1; _grant.sig=qNOBMpCTqhKdsASR4mi08F0RsYo; _session=52783fc5-e422-403a-b01f-99d1215be90d; _session.sig=IvZpq7PKkNllGmWXhVRnpFsG2Po",
    },
    "path": "/interaction/b7b7e885-d11c-451b-bc40-5192a53504f1/login",
    "pathParameters": {
        "proxy": "interaction/b7b7e885-d11c-451b-bc40-5192a53504f1/login"
    },
    "requestContext": {
        "stage": "dev"
    },
    "resource": "/{proxy*}",
    "httpMethod": "POST",
    "queryStringParameters": null,
    // TODO: It seems that we need to pass the body as an object here??
    //"body": "email=foo%40example.com&password=xyz&remember=yes&submit=",
    "body": {
        email: "foo%40example.com",
        password: "xyz",
        remember: "yes",
        submit: null
    },
    "isOffline": true
};

const event = event4;
const context = {};
handler.handler(event, context, function (error, result) {
    if (error) {
        console.error(error);
        return;
    }
    console.log(JSON.stringify(result));
});