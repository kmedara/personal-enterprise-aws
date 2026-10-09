# Personal Enterprise AWS

This repository is an Amazon Web Services (AWS) Cloud Development Kit (CDK) application. It creates an organization in
the management account, a development account inside the `workload` organizational unit, and IAM Identity Center
(Identity Center) users, groups, and assignments. A stack set then creates a `developer` role in the development
account. Another stack set creates a `github-deploy` role in every account in the `workload` organizational unit.
GitHub Actions assumes that role to deploy applications. The management account has a `github-bootstrap` role that
this repository's bootstrap workflow uses to bootstrap those workload accounts, and a `github-management-deploy` role
that this repository's deploy workflow uses to deploy these stacks.

All stacks deploy to the management account. CDK deploys **Organization** first. **IdentityCenter**, **DeveloperRole**,
**GitHubDeployRole**, and **GitHubBootstrapRole** read the new account id and the organizational unit id from that
stack, so those ids are not written back to Parameter Store after the first deploy. **GitHubOidc** and
**GitHubManagementDeployRole** deploy only in the management account.

The management account already exists. This application does not create it. Identity Center is already enabled in that
account, in the region used for the deploy. The Identity Center home region and the CDK region have to be the same.
`us-east-1` is the usual choice. The first deploy cannot sign in through the new Identity Center assignments, because
those assignments are what the deploy creates.

## Steps

The management account is bootstrapped once from your machine, in step 7. That has to happen before the GitHub roles
exist. Every workload account is bootstrapped by the **Bootstrap workload account** workflow.

1. Install **Node.js** 22 or newer, **npm**, and the **AWS Command Line Interface (AWS CLI)** version 2.

2. Clone the repository and install dependencies. `npm ci` installs the CDK application and the CLI from the lockfile.

    ```bash
    git clone <repository-url>
    cd personal-enterprise-aws
    npm ci
    ```

3. Store the configuration in Systems Manager Parameter Store, in the management account, under
   `/personal-enterprise/config`. Every parameter in `environment.ts` is required, and the parameters have to exist
   before the first deploy. Git Bash on Windows treats a leading `/` as a filesystem path. `MSYS_NO_PATHCONV=1` keeps
   the parameter name intact.

    ```bash
    PREFIX="/personal-enterprise/config"
    PROFILE="mgmt-bootstrap"
    REGION="us-east-1"

    put() {
      MSYS_NO_PATHCONV=1 aws ssm put-parameter \
        --profile "$PROFILE" \
        --region "$REGION" \
        --name "$PREFIX/$1" \
        --type String \
        --value "$2" \
        --overwrite
    }

    put MGMT_ACCOUNT_ID 123456789012
    put MGMT_ACCOUNT_EMAIL management@example.com
    put WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL development@example.com
    put IDENTITY_CENTER_INSTANCE_ARN arn:aws:sso:::instance/ssoins-0123456789abcdef
    put IDENTITY_STORE_ID d-0123456789
    put ORGANIZATIONAL_UNITS workload,security,networking
    put GITHUB_DEPLOY_SUBJECTS 'repo:<owner>/*'
    ```

   `GITHUB_DEPLOY_SUBJECTS` is a comma-separated list of GitHub Actions subjects. Each entry must name an owner.
   `repo:<owner>/*` allows every repository under that owner. `repo:<owner>/my-app:*` allows one repository.
   Repositories created after July 15, 2026 send an immutable subject, for example
   `repo:<owner>@<owner-id>/my-app@<repository-id>:*`. `repo:*/*` is rejected.

   Confirm the path returns all eight names:

    ```bash
    MSYS_NO_PATHCONV=1 aws ssm get-parameters-by-path \
      --profile mgmt-bootstrap \
      --region us-east-1 \
      --path /personal-enterprise/config \
      --query "Parameters[].Name"
    ```

    | Variable                             | What it is                                                                     |
    | ------------------------------------ | ------------------------------------------------------------------------------ |
    | `MGMT_ACCOUNT_ID`                    | Twelve-digit id of the management account                                     |
    | `MGMT_ACCOUNT_EMAIL`                 | Email address of the management account                                        |
    | `WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL` | New email address for the development account. It cannot already be an AWS account |
    | `IDENTITY_CENTER_INSTANCE_ARN`       | Amazon Resource Name (ARN) of the Identity Center instance                     |
    | `IDENTITY_STORE_ID`                  | Identity Store id for that instance                                            |
    | `ORGANIZATIONAL_UNITS`               | Organizational unit names created under the organization root                  |
    | `GITHUB_DEPLOY_SUBJECTS`             | GitHub Actions subjects allowed to assume `github-deploy` in workload accounts |
    | `IDENTITY_CENTER_USERS`              | JSON catalog of Identity Center users                                          |

    The instance ARN and the Identity Store id are on the Identity Center settings page in the console.

4. Store Identity Center users in `IDENTITY_CENTER_USERS`. A person listed under `administrators` joins the
   administrators group. A person listed under `developers` joins the developers group. The same person can be in both
   lists. `userName` is the sign-in name.

    ```bash
    MSYS_NO_PATHCONV=1 aws ssm put-parameter \
      --profile mgmt-bootstrap \
      --region us-east-1 \
      --name /personal-enterprise/config/IDENTITY_CENTER_USERS \
      --type String \
      --value '{
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
      }' \
      --overwrite
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

   The application process does not receive the CDK `--profile` flag. Export the same profile so synthesis can read
   Parameter Store:

    ```bash
    export AWS_PROFILE=mgmt-bootstrap
    ```

6. Confirm the profile lands in the management account. The account id in the response has to match `MGMT_ACCOUNT_ID`.

    ```bash
    aws sts get-caller-identity --profile mgmt-bootstrap
    ```

7. Bootstrap the CDK toolkit in the management account only. Replace the account id and region with `MGMT_ACCOUNT_ID`
   and the Identity Center home region. This is the only `cdk bootstrap` command you run locally.

    ```bash
    npx cdk bootstrap aws://123456789012/us-east-1 --profile mgmt-bootstrap
    ```

8. Deploy the **Organization** stack. This creates the organization, the organizational units, and the development
   account. Leave the command running until the stack finishes. Creating the account takes several minutes.

    ```bash
    npx cdk deploy Organization --profile mgmt-bootstrap
    ```

   Record **DevelopmentWorkloadAccountId** from the stack outputs. The bootstrap workflow needs that account id.

9. Enable CloudFormation StackSets trusted access in the management account console. The application does not do this.
   Sign in to the management account, open **AWS Organizations**, choose **Services**, select **CloudFormation
   StackSets**, and choose **Enable trusted access**. The organization from step 8 has to exist before this control is
   available. Trusted access lets the **DeveloperRole** and **GitHubDeployRole** stack sets create roles in workload
   accounts.

10. Deploy the remaining stacks. CDK asks for approval before creating IAM resources and the stack sets. Accept that
    approval.

    - **IdentityCenter** creates the users, groups, permission sets, memberships, and account assignments.
    - **DeveloperRole** creates the `developer` role in the development account.
    - **GitHubDeployRole** creates the GitHub OIDC provider and the `github-deploy` role in every workload account.
      That role can assume the CDK bootstrap roles in the same account. Only the subjects in `GITHUB_DEPLOY_SUBJECTS`
      can assume it.
    - **GitHubOidc** creates the GitHub OIDC provider in the management account. It does not create a role.
    - **GitHubBootstrapRole** creates `github-bootstrap`. Only this repository can assume it, and it can only assume
      `OrganizationAccountAccessRole` in the `workload` organizational unit.
    - **GitHubManagementDeployRole** creates `github-management-deploy`. Only this repository can assume it. It can
      assume the CDK bootstrap roles in the management account and read `/personal-enterprise/config`.

    ```bash
    npx cdk deploy IdentityCenter DeveloperRole GitHubDeployRole GitHubOidc GitHubBootstrapRole GitHubManagementDeployRole --profile mgmt-bootstrap
    ```

11. Save the role ARNs as GitHub Actions secrets on this repository. Secrets are masked in the workflow logs.

    | Stack output                       | GitHub secret                      |
    | ---------------------------------- | ---------------------------------- |
    | **GitHubBootstrapRoleArn**         | `GH_WORKLOAD_BOOTSTRAP_ROLE_ARN`    |
    | **GitHubManagementDeployRoleArn**  | `GH_MANAGEMENT_DEPLOY_ROLE_ARN`    |

12. Bootstrap the development workload account with the **Bootstrap workload account** workflow. In GitHub, open
    **Actions**, choose **Bootstrap workload account**, and run the workflow. Set `account_id` to
    **DevelopmentWorkloadAccountId** from step 8, and set `region` to the Identity Center home region.

    The workflow assumes `github-bootstrap`, then assumes `OrganizationAccountAccessRole` in that account, then runs
    `cdk bootstrap` with the default qualifier `hnb659fds`. Repeat this workflow for every later workload account.
    `github-deploy` cannot bootstrap an account. The CDK roles it assumes do not exist until this workflow finishes.

13. Sign in with Identity Center and delete the temporary key. The profile points at the Identity Center start URL,
    the management account, and the `AdministratorAccess` permission set. `sso_region` is the Identity Center home
    region.

    ```bash
    aws sso login --profile admin:mgmt
    aws sts get-caller-identity --profile admin:mgmt
    ```

    When that identity call returns the management account, delete the root access key in the console and remove the
    `[mgmt-bootstrap]` profile. Keep the root console password and multi-factor authentication (MFA).

14. Deploy later changes to this repository with the **Deploy management account** workflow. It assumes
    `github-management-deploy` and runs `cdk deploy --all`. A shell deploy still works with the Identity Center
    profile. Export it so synthesis and the CDK CLI use the same identity:

    ```bash
    export AWS_PROFILE=admin:mgmt
    npx cdk deploy --all --profile "$AWS_PROFILE"
    ```

## Application deploys

After step 12, a workflow in a repository listed in `GITHUB_DEPLOY_SUBJECTS` assumes `github-deploy` in the workload
account:

```yaml
permissions:
  id-token: write
  contents: read
steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/github-deploy
      aws-region: us-east-1
```

Replace the account id with the workload account that the bootstrap workflow prepared.

## Commands

- **`npm run build`** type-checks the project
- **`npm test`** runs the unit tests
- **`npx cdk synth`** reads `/personal-enterprise/config` with `GetParametersByPath`, then prints the CloudFormation templates without deploying. `AWS_PROFILE` has to be set
- **`npx cdk diff`** compares the templates with what is already deployed
- **`npx cdk deploy --all`** deploys Organization, IdentityCenter, DeveloperRole, GitHubDeployRole, GitHubOidc, GitHubBootstrapRole, and GitHubManagementDeployRole
