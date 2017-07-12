# oidc-lambda

WIP !
TODO: DynamoDB Adapter with auto scaling, custom domain,...

1) Clone the repo  
```
git clone https://github.com/panva/node-oidc-provider-example.git my-provider
cd my-provider
```

x) Install the dependencies and generate keystores  
```
yarn
node 01-oidc-configured/generate-keys
```

x) Copy the views
```
cp -r 03-oidc-views-accounts/views src
```

x) Copy the account model
```
cp 04-oidc-lambda/account.js src
```

x) Copy the configured index, feel free to check the diff after you do  
```
cp 04-oidc-lambda/index.js src
```



x) Commit to your local repo  
```
git add .
git commit -a -m 'run on lambda'
```


x) Done!
```


TODO

heroku open '/.well-known/openid-configuration' # to see your openid-configuration  
heroku open '/auth?client_id=foo&response_type=code&scope=openid' # to start your first Authentication Request
```

You should see a login screen prompting you to enter any login and password, after doing so your
Request will be resolved and you will be redirected to lvh.me (your localhost) with an authorization_code
in the query.
