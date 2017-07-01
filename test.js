"use strict";

var handler = require("./src/index");
var event = {
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
};
var context = {};
handler.handler(event, context, function (error, result) {
    if (error) {
        console.error(error);
        return;
    }
    console.log(JSON.stringify(result));
});
