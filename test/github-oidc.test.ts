import { Template } from "aws-cdk-lib/assertions";
import { App } from "aws-cdk-lib/core";
import { GitHubOidcStack } from "../lib/account/github-oidc.stack";

test("github oidc stack creates only the provider", () => {
  const app = new App();
  const stack = new GitHubOidcStack(app, "GitHubOidc", {
    env: { account: "111111111111", region: "us-east-1" },
  });
  const templateJson = JSON.stringify(Template.fromStack(stack).toJSON());

  expect(templateJson).toContain("Custom::AWSCDKOpenIdConnectProvider");
  expect(templateJson).toContain("https://token.actions.githubusercontent.com");
  expect(templateJson).not.toContain("github-bootstrap");
  expect(templateJson).not.toContain("github-management-deploy");
});
