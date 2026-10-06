# personal-enterprise-aws

CDK app for an existing AWS Organization with two accounts:

- **management**, at the org root
- **workload-dev**, the dev account under the `workload` OU

The app deploys into those accounts. It does not create the organization, the OU, or the accounts.

## Configure

Set `accounts.management.id` and `accounts.workloadDev.id` in [`config/accounts.json`](config/accounts.json) to the 12-digit account IDs. Leave the aliases, profiles, and OU paths as they are unless your CLI profile names differ.

`management` sits at the org root (`/`). `workload-dev` is the dev account under the `workload` OU (`/workload`).

Sign in to both profiles before deploying. With IAM Identity Center that is `aws sso login --profile management` and the same for `workload-dev`.

## Bootstrap

Run once per account. Replace the IDs with the values from `config/accounts.json`.

```bash
npx cdk bootstrap aws://MANAGEMENT_ACCOUNT_ID/us-east-1 --profile management
npx cdk bootstrap aws://WORKLOAD_DEV_ACCOUNT_ID/us-east-1 --profile workload-dev
```

## Deploy

```bash
npm run deploy:management
npm run deploy:workload-dev
```

Preview with `npm run diff:management` and `npm run diff:workload-dev`. Deploy one account at a time so each command uses that account's credentials. CDK rejects a deploy when the credentials do not match the stack's account.

The management stack writes the account catalog to SSM parameter `/personal-enterprise/org/accounts`. Each account stack records its alias and OU path under `/personal-enterprise/account/`.
