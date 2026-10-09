import { Match, Template } from "aws-cdk-lib/assertions";
import { App } from "aws-cdk-lib/core";
import {
  GITHUB_MANAGEMENT_DEPLOY_ROLE_NAME,
  GitHubManagementDeployRoleStack,
} from "../lib/account/github-management-deploy-role.stack";
import { GITHUB_OIDC_SUBJECT } from "../lib/account/github-oidc";
import { GitHubOidcStack } from "../lib/account/github-oidc.stack";

const ACCOUNT_ID = "111111111111";

test("management deploy role stays in this account and this repository workflow", () => {
  const app = new App();
  const githubOidc = new GitHubOidcStack(app, "GitHubOidc", {
    env: { account: ACCOUNT_ID, region: "us-east-1" },
  });
  const stack = new GitHubManagementDeployRoleStack(
    app,
    "GitHubManagementDeployRole",
    {
      env: { account: ACCOUNT_ID, region: "us-east-1" },
      gitHubOidcProvider: githubOidc.provider,
    },
  );
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::IAM::Role", {
    RoleName: GITHUB_MANAGEMENT_DEPLOY_ROLE_NAME,
    AssumeRolePolicyDocument: Match.objectLike({
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: "sts:AssumeRoleWithWebIdentity",
          Condition: {
            StringEquals: {
              "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            },
            StringLike: {
              "token.actions.githubusercontent.com:sub": GITHUB_OIDC_SUBJECT,
            },
          },
        }),
      ]),
    }),
  });

  const policies = template.findResources("AWS::IAM::Policy");
  const policy = JSON.stringify(policies);

  expect(policy).toContain(
    `arn:aws:iam::${ACCOUNT_ID}:role/cdk-hnb659fds-deploy-role-${ACCOUNT_ID}-*`,
  );
  expect(policy).toContain("ssm:GetParametersByPath");
  expect(policy).toContain(
    ":ssm:us-east-1:111111111111:parameter/personal-enterprise/config/*",
  );
  expect(policy).not.toContain("OrganizationAccountAccessRole");
  expect(policy).not.toContain("AdministratorAccess");
  expect(JSON.stringify(template.toJSON())).not.toContain(
    "Custom::AWSCDKOpenIdConnectProvider",
  );
});
