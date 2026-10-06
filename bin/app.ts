#!/usr/bin/env node
import path from "node:path";
import { App } from "aws-cdk-lib";
import { defineOrganization } from "../lib/define-organization";
import { loadOrganizationAccounts, type AccountOverrides } from "../lib/load-accounts";

const app = new App();

defineOrganization(
  app,
  loadOrganizationAccounts(path.join(__dirname, "../config/accounts.json"), contextOverrides(app)),
);

function contextOverrides(app: App): AccountOverrides {
  return {
    region: contextString(app, "region"),
    managementAccountId: contextString(app, "managementAccountId"),
    workloadDevAccountId: contextString(app, "workloadDevAccountId"),
  };
}

function contextString(app: App, key: string): string | undefined {
  const value = app.node.tryGetContext(key);
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Context ${key} must be a string.`);
  }
  return value;
}
