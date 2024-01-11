# Engagemint Indexer

## Configuration

### AWS Credentials
Add a profile called 'EngageMint' to your local AWS credentials by running `aws configure sso` and naming your profile 'EngageMint' when it asks.

## Local Development

### Testing the handler
Run `yarn test-handler` to test the handler locally. This will run the handler against the sample event in `test/event.json`.

## Deploying
This project is set up to automatically redeploy if you push to the `main` branch. However, if you want to deploy manually, run `./scripts/deploy.sh` which will build and upload the resulting zip file to the s3 bucket. You will then theed to redeploy the lambda function inside the `engagemint-infra` repo.
