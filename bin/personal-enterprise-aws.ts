#!/usr/bin/env node
/**
 * Amazon Web Services (AWS) Cloud Development Kit (CDK) application entry point.
 *
 * Loads the required environment, then creates the organization, Identity Center,
 * and developer role stacks in the management account.
 */
import * as cdk from "aws-cdk-lib/core";
import { config } from "dotenv";
import { DeveloperRoleStack } from "../lib/account/developer-role.stack";
import { IdentityCenterStack } from "../lib/IAM/identity-center.stack";
import { OrganizationStack } from "../lib/org/organization";
import type { Environment } from "../lib/environment.interface";
config();

/** CDK application that owns every stack. */
const app = new cdk.App();

/** Values copied from the process environment before the stacks are created. */
var env: Pick<typeof process.env, keyof Environment> = {
  MGMT_ACCOUNT_ID: required("MGMT_ACCOUNT_ID"),
  MGMT_ACCOUNT_EMAIL: required("MGMT_ACCOUNT_EMAIL"),
  WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL: required(
    "WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL",
  ),
  IDENTITY_CENTER_INSTANCE_ARN: required("IDENTITY_CENTER_INSTANCE_ARN"),
  IDENTITY_STORE_ID: required("IDENTITY_STORE_ID"),
  ORGANIZATIONAL_UNITS: required("ORGANIZATIONAL_UNITS"),
};

/** Account id of the organization management account. */
const managementAccountId = env.MGMT_ACCOUNT_ID;
/** Region selected by the CDK Command Line Interface (CLI). */
const region = process.env.CDK_DEFAULT_REGION;

/** Account and region where the management stacks deploy. */
const managementEnv: cdk.Environment = {
  account: managementAccountId,
  region,
};

/** Organizational unit names parsed from `ORGANIZATIONAL_UNITS`. */
const organizationalUnitNames = (process.env.ORGANIZATIONAL_UNITS ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter((name) => name.length > 0);

/** Organization stack. Later stacks read its account and unit ids. */
const organization = new OrganizationStack(app, "Organization", {
  env: managementEnv,
  organizationalUnitNames,
  WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL: required(
    "WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL",
  ),
});

new IdentityCenterStack(app, "IdentityCenter", {
  env: managementEnv,
  IDENTITY_CENTER_INSTANCE_ARN: required("IDENTITY_CENTER_INSTANCE_ARN"),
  IDENTITY_STORE_ID: required("IDENTITY_STORE_ID"),
  accountIds: {
    management: managementAccountId,
    "workload:development": organization.developmentAccountId,
  },
});

var developerRole = new DeveloperRoleStack(app, "DeveloperRole", {
  env: managementEnv,
  WORKLOAD_DEVELOPMENT_ACCOUNT_ID: organization.developmentAccountId,
  WORKLOAD_OU_ID: organization.workloadOuId,
});

developerRole.node.addDependency(organization);

/**
 * Reads a required environment variable.
 *
 * @param name - The name of the environment variable.
 * @returns The value of the environment variable.
 * @throws When the environment variable is missing or empty.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}
