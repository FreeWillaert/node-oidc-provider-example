#!/bin/bash

# Check argument count and show usage if not ok.
if [[ $# -lt 3 ]]; then
	echo "Usage: `basename $0` <awsProfile> <stage> <instanceId>"
	exit 1
fi

awsProfile=$1
stage=$2
instanceId=$3

./node_modules/serverless/bin/serverless deploy --aws-profile $awsProfile -s $stage --instanceId $instanceId