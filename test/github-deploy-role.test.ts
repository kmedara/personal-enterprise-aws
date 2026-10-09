import { Template } from "aws-cdk-lib/assertions";
import { App } from "aws-cdk-lib/core";
import {
  GitHubDeployRoleStack,
  parseGitHubDeploySubjects,
} from "../lib/account/github-deploy-role.stack";

test("github deploy role trusts only the configured subjects", () => {
  const app = new App();
  const stack = new GitHubDeployRoleStack(app, "GitHubDeployRole", {
    env: { account: "111111111111", region: "us-east-1" },
    WORKLOAD_OU_ID: "ou-abcd-12345678",
    WORKLOAD_DEVELOPMENT_ACCOUNT_ID: "123456789012",
    GITHUB_DEPLOY_SUBJECTS:
      "repo:example/app:*, repo:example/other:ref:refs/heads/main",
  });

  const stackSets = Template.fromStack(stack).findResources(
    "AWS::CloudFormation::StackSet",
  );
  const templateBody = JSON.parse(
    Object.values(stackSets)[0].Properties.TemplateBody,
  ) as {
    Resources: {
      GitHubDeploy: {
        Properties: {
          AssumeRolePolicyDocument: {
            Statement: Array<{
              Condition: { StringLike: Record<string, string[]> };
            }>;
          };
        };
      };
    };
  };

  expect(
    templateBody.Resources.GitHubDeploy.Properties.AssumeRolePolicyDocument
      .Statement[0].Condition.StringLike[
      "token.actions.githubusercontent.com:sub"
    ],
  ).toEqual([
    "repo:example/app:*",
    "repo:example/other:ref:refs/heads/main",
  ]);
});

test("github deploy role can only assume the CDK bootstrap roles", () => {
  const app = new App();
  const stack = new GitHubDeployRoleStack(app, "GitHubDeployRole", {
    env: { account: "111111111111", region: "us-east-1" },
    WORKLOAD_OU_ID: "ou-abcd-12345678",
    WORKLOAD_DEVELOPMENT_ACCOUNT_ID: "123456789012",
    GITHUB_DEPLOY_SUBJECTS: "repo:example/app:*",
  });

  const stackSets = Template.fromStack(stack).findResources(
    "AWS::CloudFormation::StackSet",
  );
  const templateBody = JSON.parse(
    Object.values(stackSets)[0].Properties.TemplateBody,
  ) as {
    Resources: {
      GitHubDeploy: {
        Properties: {
          ManagedPolicyArns?: string[];
          Policies: Array<{
            PolicyDocument: {
              Statement: Array<{ Action: string[]; Resource: unknown[] }>;
            };
          }>;
        };
      };
    };
  };
  const role = templateBody.Resources.GitHubDeploy.Properties;

  expect(role.ManagedPolicyArns).toBeUndefined();
  expect(JSON.stringify(role)).not.toContain("AdministratorAccess");
  expect(role.Policies[0].PolicyDocument.Statement[0].Action).toEqual([
    "sts:AssumeRole",
    "sts:TagSession",
  ]);
  expect(role.Policies[0].PolicyDocument.Statement[0].Resource).toEqual([
    {
      "Fn::Sub":
        "arn:aws:iam::${AWS::AccountId}:role/cdk-hnb659fds-deploy-role-${AWS::AccountId}-*",
    },
    {
      "Fn::Sub":
        "arn:aws:iam::${AWS::AccountId}:role/cdk-hnb659fds-file-publishing-role-${AWS::AccountId}-*",
    },
    {
      "Fn::Sub":
        "arn:aws:iam::${AWS::AccountId}:role/cdk-hnb659fds-image-publishing-role-${AWS::AccountId}-*",
    },
    {
      "Fn::Sub":
        "arn:aws:iam::${AWS::AccountId}:role/cdk-hnb659fds-lookup-role-${AWS::AccountId}-*",
    },
  ]);
});

test("accepts an immutable subject that names an owner and repository", () => {
  expect(
    parseGitHubDeploySubjects(
      "repo:example@12345678/app@87654321:*",
    ),
  ).toEqual(["repo:example@12345678/app@87654321:*"]);
});

test("rejects a subject that can match every GitHub repository", () => {
  expect(() => parseGitHubDeploySubjects("repo:*/*")).toThrow(
    /must name an owner/,
  );
  expect(() => parseGitHubDeploySubjects("*")).toThrow(/must name an owner/);
});
