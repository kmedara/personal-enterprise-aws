import { Match, Template } from "aws-cdk-lib/assertions";
import { App } from "aws-cdk-lib/core";
import {
  GITHUB_BOOTSTRAP_ROLE_NAME,
  GitHubBootstrapRoleStack,
} from "../lib/account/github-bootstrap-role.stack";
import { GITHUB_OIDC_SUBJECT } from "../lib/account/github-oidc";
import { GitHubOidcStack } from "../lib/account/github-oidc.stack";

test("github bootstrap role can assume OrganizationAccountAccessRole only in the workload unit", () => {
  const app = new App();
  const githubOidc = new GitHubOidcStack(app, "GitHubOidc", {
    env: { account: "111111111111", region: "us-east-1" },
  });
  const stack = new GitHubBootstrapRoleStack(app, "GitHubBootstrapRole", {
    env: { account: "111111111111", region: "us-east-1" },
    ORGANIZATION_ID: "o-example",
    ROOT_ID: "r-example",
    WORKLOAD_OU_ID: "ou-example",
    gitHubOidcProvider: githubOidc.provider,
  });
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::IAM::Role", {
    RoleName: GITHUB_BOOTSTRAP_ROLE_NAME,
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

  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: {
      Statement: [
        {
          Action: "sts:AssumeRole",
          Effect: "Allow",
          Resource: "arn:aws:iam::*:role/OrganizationAccountAccessRole",
          Condition: {
            "ForAnyValue:StringLike": {
              "aws:ResourceOrgPaths": ["o-example/r-example/ou-example/*"],
            },
          },
        },
      ],
    },
  });

  const templateJson = JSON.stringify(template.toJSON());
  expect(templateJson).not.toContain("AdministratorAccess");
  expect(templateJson).not.toContain("Custom::AWSCDKOpenIdConnectProvider");
});
