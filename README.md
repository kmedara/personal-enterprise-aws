# Personal Enterprise AWS

This repository is an Amazon Web Services (AWS) Cloud Development Kit (CDK) application. It creates an organization in
the management account, a development account inside the `workload` organizational unit, and IAM Identity Center
(Identity Center) users, groups, and assignments. A stack set then creates a `developer` role in the development
account.

All three stacks deploy to the management account. CDK deploys **Organization** first. **IdentityCenter** and
**DeveloperRole** read the new account id and the organizational unit id from that stack, so those ids are not copied
into the environment file after the first deploy.

## What has to exist first

The management account already exists. This application does not create it. Identity Center is already enabled in that
account, in the region used for the deploy. The Identity Center home region and the CDK region have to be the same.
`us-east-1` is the usual choice.

The first deploy cannot sign in through the new Identity Center assignments. Those assignments are what the deploy
creates. The first bootstrap and deploy use an administrator credential that is already in the management account: the
root access key, or an existing IAM user with administrator access. After Identity Center sign-in works, that key is
deleted.

The machine needs **Node.js** 22 or newer, **npm**, and the **AWS Command Line Interface (AWS CLI)** version 2.

## Get the code and install dependencies

```bash
git clone <repository-url>
cd personal-enterprise-aws
npm ci
```

`npm ci` installs the CDK application and the CLI from the lockfile.

## Configuration files

Two local files are required. Both are gitignored.

### `.env`

The application reads this file on every `cdk` command. Every variable below is required. `ORGANIZATIONAL_UNITS` is a
comma-separated list and must include `workload`, because the development account is created in that unit.

```bash
MGMT_ACCOUNT_ID=123456789012
MGMT_ACCOUNT_EMAIL=management@example.com
WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL=development@example.com
IDENTITY_CENTER_INSTANCE_ARN=arn:aws:sso:::instance/ssoins-0123456789abcdef
IDENTITY_STORE_ID=d-0123456789
ORGANIZATIONAL_UNITS=workload,security,networking
```

| Variable                             | What it is                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `MGMT_ACCOUNT_ID`                    | Twelve-digit id of the management account                                      |
| `MGMT_ACCOUNT_EMAIL`                 | Email address of the management account                                         |
| `WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL` | New email address for the development account. It cannot already be an AWS account |
| `IDENTITY_CENTER_INSTANCE_ARN`       | Amazon Resource Name (ARN) of the Identity Center instance                      |
| `IDENTITY_STORE_ID`                  | Identity Store id for that instance                                             |
| `ORGANIZATIONAL_UNITS`               | Organizational unit names created under the organization root                   |

The instance ARN and the Identity Store id are on the Identity Center settings page in the console.

### `config/users.json`

Identity Center users come from this file. A person listed under `administrators` joins the administrators group. A
person listed under `developers` joins the developers group. The same person can be in both lists. `userName` is the
sign-in name.

```json
{
  "administrators": [
    {
      "userName": "ada",
      "givenName": "Ada",
      "familyName": "Lovelace",
      "email": "ada@example.com"
    }
  ],
  "developers": [
    {
      "userName": "ada",
      "givenName": "Ada",
      "familyName": "Lovelace",
      "email": "ada@example.com"
    }
  ]
}
```

## Credentials for the first deploy

Create a root access key in the management account console: account menu, **Security credentials**, **Access keys**.
Put the key in `~/.aws/credentials` under a profile used only for this deploy. Set the region to the Identity Center
home region.

```ini
[mgmt-bootstrap]
aws_access_key_id=AKIA...
aws_secret_access_key=...
region=us-east-1
```

Confirm the profile lands in the management account:

```bash
aws sts get-caller-identity --profile mgmt-bootstrap
```

The account id in the response has to match `MGMT_ACCOUNT_ID`.

## Bootstrap and deploy

Bootstrap once per management account and region. Then deploy every stack:

```bash
npx cdk bootstrap aws://123456789012/us-east-1 --profile mgmt-bootstrap
npx cdk deploy --all --profile mgmt-bootstrap
```

Replace the account id and region with the values from `.env` and the profile. CDK asks for approval before creating
IAM resources and the stack set. Accept that approval.

**Organization** creates the organization, the organizational units, and the development account, and turns on
CloudFormation StackSets access. **IdentityCenter** creates the users, groups, permission sets, memberships, and
account assignments. **DeveloperRole** stays in the management account and uses a stack set to create the `developer`
role in the development account.

Leave the command running until all three stacks finish. Creating the account and the stack set instance takes several
minutes.

## Sign in with Identity Center

After the deploy, the AWS CLI profile for day-to-day work points at the Identity Center start URL, the management
account, and the `AdministratorAccess` permission set. The `sso_region` is the Identity Center home region.

```bash
aws sso login --profile admin:mgmt
aws sts get-caller-identity --profile admin:mgmt
```

When that identity call returns the management account, delete the root access key in the console and remove the
`[mgmt-bootstrap]` profile. Keep the root console password and multi-factor authentication (MFA). Later deploys use
the Identity Center profile:

```bash
npx cdk deploy --all --profile admin:mgmt
```

## Commands

- **`npm run build`** type-checks the project
- **`npm test`** runs the unit tests
- **`npx cdk synth`** prints the CloudFormation templates without deploying
- **`npx cdk diff`** compares the templates with what is already deployed
- **`npx cdk deploy --all`** deploys Organization, IdentityCenter, and DeveloperRole
