# Personal Enterprise AWS

This repository is an Amazon Web Services (AWS) Cloud Development Kit (CDK) application. It creates an organization in
the management account, a development account inside the `workload` organizational unit, and IAM Identity Center
(Identity Center) users, groups, and assignments. A stack set then creates a `developer` role in the development
account.

All three stacks deploy to the management account. CDK deploys **Organization** first. **IdentityCenter** and
**DeveloperRole** read the new account id and the organizational unit id from that stack, so those ids are not copied
into the environment file after the first deploy.

The management account already exists. This application does not create it. Identity Center is already enabled in that
account, in the region used for the deploy. The Identity Center home region and the CDK region have to be the same.
`us-east-1` is the usual choice. The first deploy cannot sign in through the new Identity Center assignments, because
those assignments are what the deploy creates.

## Steps

1. Install **Node.js** 22 or newer, **npm**, and the **AWS Command Line Interface (AWS CLI)** version 2.

2. Clone the repository and install dependencies. `npm ci` installs the CDK application and the CLI from the lockfile.

    ```bash
    git clone <repository-url>
    cd personal-enterprise-aws
    npm ci
    ```

3. Create `.env` in the repository root. The application reads this file on every `cdk` command. Every variable below
   is required. `ORGANIZATIONAL_UNITS` is a comma-separated list and must include `workload`, because the development
   account is created in that unit. Both `.env` and `config/users.json` are gitignored.

    ```bash
    MGMT_ACCOUNT_ID=123456789012
    MGMT_ACCOUNT_EMAIL=management@example.com
    WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL=development@example.com
    IDENTITY_CENTER_INSTANCE_ARN=arn:aws:sso:::instance/ssoins-0123456789abcdef
    IDENTITY_STORE_ID=d-0123456789
    ORGANIZATIONAL_UNITS=workload,security,networking
    ```

    | Variable                             | What it is                                                                           |
    | ------------------------------------ | ------------------------------------------------------------------------------------ |
    | `MGMT_ACCOUNT_ID`                    | Twelve-digit id of the management account                                           |
    | `MGMT_ACCOUNT_EMAIL`                 | Email address of the management account                                              |
    | `WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL` | New email address for the development account. It cannot already be an AWS account |
    | `IDENTITY_CENTER_INSTANCE_ARN`       | Amazon Resource Name (ARN) of the Identity Center instance                           |
    | `IDENTITY_STORE_ID`                  | Identity Store id for that instance                                                  |
    | `ORGANIZATIONAL_UNITS`               | Organizational unit names created under the organization root                        |

    The instance ARN and the Identity Store id are on the Identity Center settings page in the console.

4. Create `config/users.json`. A person listed under `administrators` joins the administrators group. A person listed
   under `developers` joins the developers group. The same person can be in both lists. `userName` is the sign-in name.

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

5. Create a temporary administrator credential for the first deploy. In the management account console, open the
   account menu, then **Security credentials**, then **Access keys**. Put the root access key, or an existing IAM user
   key with administrator access, in `~/.aws/credentials`. Set the region to the Identity Center home region.

    ```ini
    [mgmt-bootstrap]
    aws_access_key_id=AKIA...
    aws_secret_access_key=...
    region=us-east-1
    ```

6. Confirm the profile lands in the management account. The account id in the response has to match `MGMT_ACCOUNT_ID`.

    ```bash
    aws sts get-caller-identity --profile mgmt-bootstrap
    ```

7. Bootstrap the CDK toolkit once in the management account and region. Replace the account id and region with the
   values from `.env` and the profile.

    ```bash
    npx cdk bootstrap aws://123456789012/us-east-1 --profile mgmt-bootstrap
    ```

8. Deploy the **Organization** stack. This creates the organization, the organizational units, and the development
   account. Leave the command running until the stack finishes. Creating the account takes several minutes.

    ```bash
    npx cdk deploy Organization --profile mgmt-bootstrap
    ```

9. Enable CloudFormation StackSets trusted access in the management account console. The application does not do this.
   Sign in to the management account, open **AWS Organizations**, choose **Services**, select **CloudFormation
   StackSets**, and choose **Enable trusted access**. The organization from step 8 has to exist before this control is
   available. Trusted access lets the **DeveloperRole** stack set create the `developer` role in the development
   account.

10. Deploy **IdentityCenter** and **DeveloperRole**. CDK asks for approval before creating IAM resources and the stack
    set. Accept that approval. **IdentityCenter** creates the users, groups, permission sets, memberships, and account
    assignments. **DeveloperRole** stays in the management account and uses the stack set to create the `developer`
    role in the development account.

    ```bash
    npx cdk deploy IdentityCenter DeveloperRole --profile mgmt-bootstrap
    ```

11. Sign in with Identity Center and remove the temporary key. The AWS CLI profile for day-to-day work points at the
    Identity Center start URL, the management account, and the `AdministratorAccess` permission set. `sso_region` is
    the Identity Center home region.

    ```bash
    aws sso login --profile admin:mgmt
    aws sts get-caller-identity --profile admin:mgmt
    ```

    When that identity call returns the management account, delete the root access key in the console and remove the
    `[mgmt-bootstrap]` profile. Keep the root console password and multi-factor authentication (MFA). Later deploys
    use the Identity Center profile:

    ```bash
    npx cdk deploy --all --profile admin:mgmt
    ```

## Commands

- **`npm run build`** type-checks the project
- **`npm test`** runs the unit tests
- **`npx cdk synth`** prints the CloudFormation templates without deploying
- **`npx cdk diff`** compares the templates with what is already deployed
- **`npx cdk deploy --all`** deploys Organization, IdentityCenter, and DeveloperRole
