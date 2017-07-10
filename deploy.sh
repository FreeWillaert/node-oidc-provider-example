#!/bin/bash

# Check argument count and show usage if not ok.
if [[ $# -lt 2 ]]; then
	echo "Usage: `basename $0` <awsProfile> <stage>"
	exit 1
fi

awsProfile=$1
stage=$2

./node_modules/serverless/bin/serverless deploy --aws-profile $awsProfile -s $stage