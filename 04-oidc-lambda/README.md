# oidc-lambda

Previous [03-oidc-views-accounts](../03-oidc-views-accounts/README.md)

Please note: this example extends on the examples 01-03 by panva, following his guidance to make oidc-provider work on AWS Lambda using Serverless. Also the Dynamo adapter was provided by panva.

1) Clone the repo  
```
git clone https://github.com/FreeWillaert/node-oidc-provider-example.git my-provider
cd my-provider
```

2) Install the dependencies and generate keystores using the script in example 01
```
yarn
node 01-oidc-configured/generate-keys
```

3) Copy the views and account model from example 03
```
cp -r 03-oidc-views-accounts/views src
cp 03-oidc-lambda/account.js src
```

4) Copy the configured index, feel free to check the diff after you do  
```
cp 04-oidc-lambda/index.js src
```

5) Copy Serverless files to the base folder
```
cp 04-oidc-lambda/deploy.sh .
cp 04-oidc-lambda/deploy-function.sh .
cp 04-oidc-lambda/serverless.yml .
```

Please note: 
In serverless.yml, there is configuration for DynamoDB Auto Scaling (using the serverless-dynamodb-autoscaling plugin), which has been commented since it seemed to give problems from time to time. It may save you lots of time to simply uncomment and run deploy once. 
There is also configuration for creating a path mapping in an API Gateway Custom Domain, which is also disabled since it seemed to give some problems.

6) Commit to your local repo (optional)
```
git add .
git commit -a -m 'run on lambda'
```

7) Deploy to AWS, specifying AWS profile, stage and instance identifier, e.g.
```
./deploy.sh default dev instance1
```

8) Finally, you need to register an API Gateway Custom Domain Name, linked to an ACM Certificate in us-east-1. Give it a base path mapping with empty path and linked to the just created API and stage.
Please refer to AWS docs for detailed instructions.

9) Done!



Please note: it is possible to use Serverless Offline to run locally, but this requires some hacking which is not ripe for documenting here.