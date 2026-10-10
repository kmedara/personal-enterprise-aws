#!/usr/bin/env node
/**
 * Amazon Web Services (AWS) Cloud Development Kit (CDK) application entry point.
 *
 * Loads configuration from Systems Manager Parameter Store, then creates the
 * organization, Identity Center, developer role, GitHub deploy role, GitHub
 * OIDC provider, bootstrap role, and management deploy role stacks in the
 * management account.
 */
import {
  GetParametersByPathCommand,
  SSMClient,
  type Parameter,
} from "@aws-sdk/client-ssm";
import * as cdk from "aws-cdk-lib/core";
import { DeveloperRoleStack } from "../lib/account/developer-role.stack";
import { GitHubBootstrapRoleStack } from "../lib/account/github-bootstrap-role.stack";
import { GitHubDeployRoleStack } from "../lib/account/github-deploy-role.stack";
import { GitHubManagementDeployRoleStack } from "../lib/account/github-management-deploy-role.stack";
import { GitHubOidcStack } from "../lib/account/github-oidc.stack";
import { CONFIG_PARAMETER_PATH, type Environment } from "../lib/environment";
import { IdentityCenterStack } from "../lib/IAM/identity-center.stack";
import { parseUsers } from "../lib/IAM/load-users";
import { OrganizationStack } from "../lib/org/organization";

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * Builds every stack after Parameter Store configuration has loaded.
 * These values are required to choose the management account, so the lookup
 * happens before any stack exists.
 */
async function main(): Promise<void> {
  /** Region selected by the CDK Command Line Interface (CLI), or `AWS_REGION`. */
  const region =
    process.env.CDK_DEFAULT_REGION ??
    process.env.AWS_REGION ??
    process.env.AWS_DEFAULT_REGION;
  if (!region) {
    throw new Error(
      "A region is required to read Parameter Store. Run through the CDK CLI, or set AWS_REGION.",
    );
  }

  const env = await loadEnvironment(region);
  /** CDK application that owns every stack. */
  const app = new cdk.App();
  /** Account id of the organization management account. */
  const managementAccountId = env.MGMT_ACCOUNT_ID;

  /** Account and region where the management stacks deploy. */
  const managementEnv: cdk.Environment = {
    account: managementAccountId,
    region,
  };

  /** Organizational unit names parsed from `ORGANIZATIONAL_UNITS`. */
  const organizationalUnitNames = env.ORGANIZATIONAL_UNITS.split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  /** Organization stack. Later stacks read its account and unit ids. */
  const organization = new OrganizationStack(app, "Organization", {
    env: managementEnv,
    organizationalUnitNames,
    WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL: env.WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL,
  });

  new IdentityCenterStack(app, "IdentityCenter", {
    env: managementEnv,
    IDENTITY_CENTER_INSTANCE_ARN: env.IDENTITY_CENTER_INSTANCE_ARN,
    IDENTITY_STORE_ID: env.IDENTITY_STORE_ID,
    accountIds: {
      management: managementAccountId,
      "workload:staging": organization.developmentAccountId,
    },
    users: parseUsers(env.IDENTITY_CENTER_USERS),
  });

  const developerRole = new DeveloperRoleStack(app, "DeveloperRole", {
    env: managementEnv,
    WORKLOAD_DEVELOPMENT_ACCOUNT_ID: organization.developmentAccountId,
    WORKLOAD_OU_ID: organization.workloadOuId,
  });

  developerRole.node.addDependency(organization);

  const githubDeployRole = new GitHubDeployRoleStack(app, "GitHubDeployRole", {
    env: managementEnv,
    WORKLOAD_OU_ID: organization.workloadOuId,
    WORKLOAD_DEVELOPMENT_ACCOUNT_ID: organization.developmentAccountId,
    GITHUB_DEPLOY_SUBJECTS: env.GITHUB_DEPLOY_SUBJECTS,
  });

  githubDeployRole.node.addDependency(organization);

  const githubOidc = new GitHubOidcStack(app, "GitHubOidc", {
    env: managementEnv,
  });

  const githubBootstrapRole = new GitHubBootstrapRoleStack(
    app,
    "GitHubBootstrapRole",
    {
      env: managementEnv,
      ORGANIZATION_ID: organization.organizationId,
      ROOT_ID: organization.rootId,
      WORKLOAD_OU_ID: organization.workloadOuId,
      gitHubOidcProvider: githubOidc.provider,
    },
  );

  githubBootstrapRole.node.addDependency(organization);

  new GitHubManagementDeployRoleStack(app, "GitHubManagementDeployRole", {
    env: managementEnv,
    gitHubOidcProvider: githubOidc.provider,
  });
}

/**
 * Reads every parameter directly under {@link CONFIG_PARAMETER_PATH}.
 *
 * The CDK `--profile` flag is not passed into this process. The AWS SDK uses
 * `AWS_PROFILE` and the default credential chain.
 *
 * @param region - Region that holds the parameters.
 */
async function loadEnvironment(region: string): Promise<Environment> {
  const parameters = await getParametersByPath(region, CONFIG_PARAMETER_PATH);
  return {
    MGMT_ACCOUNT_ID: required(parameters, "MGMT_ACCOUNT_ID"),
    MGMT_ACCOUNT_EMAIL: required(parameters, "MGMT_ACCOUNT_EMAIL"),
    WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL: required(
      parameters,
      "WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL",
    ),
    IDENTITY_CENTER_INSTANCE_ARN: required(
      parameters,
      "IDENTITY_CENTER_INSTANCE_ARN",
    ),
    IDENTITY_STORE_ID: required(parameters, "IDENTITY_STORE_ID"),
    ORGANIZATIONAL_UNITS: required(parameters, "ORGANIZATIONAL_UNITS"),
    GITHUB_DEPLOY_SUBJECTS: required(parameters, "GITHUB_DEPLOY_SUBJECTS"),
    IDENTITY_CENTER_USERS: required(parameters, "IDENTITY_CENTER_USERS"),
  };
}

/**
 * Calls `GetParametersByPath` and follows `NextToken` until the path is exhausted.
 *
 * @param region - Region that holds the parameters.
 * @param path - Fully qualified parameter path, starting with `/`.
 * @returns Parameter names with the path prefix removed.
 */
async function getParametersByPath(
  region: string,
  path: string,
): Promise<ReadonlyMap<string, string>> {
  const client = new SSMClient({ region });
  const prefix = `${path}/`;
  const values = new Map<string, string>();
  let nextToken: string | undefined;

  do {
    const page = await client.send(
      new GetParametersByPathCommand({
        Path: path,
        Recursive: false,
        NextToken: nextToken,
      }),
    );
    for (const parameter of page.Parameters ?? []) {
      const name = parameterName(parameter, prefix);
      const value = parameter.Value?.trim();
      if (name && value) {
        values.set(name, value);
      }
    }
    nextToken = page.NextToken;
  } while (nextToken);

  return values;
}

/**
 * Returns the parameter name relative to `prefix`, ignoring nested paths.
 *
 * @param parameter - One page entry from `GetParametersByPath`.
 * @param prefix - Absolute path prefix, including the trailing slash.
 */
function parameterName(
  parameter: Parameter,
  prefix: string,
): string | undefined {
  const name = parameter.Name;
  if (!name?.startsWith(prefix)) {
    return undefined;
  }
  const relative = name.slice(prefix.length);
  if (!relative || relative.includes("/")) {
    return undefined;
  }
  return relative;
}

/**
 * Reads a required parameter loaded from {@link CONFIG_PARAMETER_PATH}.
 *
 * @param parameters - Names and values returned by `GetParametersByPath`.
 * @param name - Parameter name under the common path.
 * @returns The stored value.
 * @throws When the parameter is missing or empty.
 */
function required(
  parameters: ReadonlyMap<string, string>,
  name: keyof Environment,
): string {
  const value = parameters.get(name);
  if (!value) {
    throw new Error(`${name} is required at ${CONFIG_PARAMETER_PATH}/${name}.`);
  }
  return value;
}
