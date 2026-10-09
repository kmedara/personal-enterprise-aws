import {
  PolicyStatement,
  Role,
  WebIdentityPrincipal,
  type IOpenIdConnectProvider,
} from "aws-cdk-lib/aws-iam";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { CONFIG_PARAMETER_PATH } from "../environment";
import {
  GITHUB_OIDC_AUDIENCE,
  GITHUB_OIDC_HOST,
  GITHUB_OIDC_SUBJECT,
} from "./github-oidc";

/** Properties for {@link GitHubManagementDeployRoleStack}. */
export type GitHubManagementDeployRoleStackProps = cdk.StackProps & {
  /** GitHub OIDC provider created by the provider stack. */
  gitHubOidcProvider: IOpenIdConnectProvider;
};

/** Role in the management account that deploys this CDK application. */
export const GITHUB_MANAGEMENT_DEPLOY_ROLE_NAME = "github-management-deploy";

/** Default Cloud Development Kit (CDK) bootstrap qualifier. */
const CDK_QUALIFIER = "hnb659fds";

/**
 * Bootstrap role name suffixes this role is allowed to assume in the management account.
 * CloudFormation execution stays on the deploy role.
 */
const CDK_BOOTSTRAP_ROLE_SUFFIXES = [
  "deploy-role",
  "file-publishing-role",
  "image-publishing-role",
  "lookup-role",
];

/**
 * Creates a GitHub Actions role that deploys this application in the management account.
 *
 * The role can assume the CDK bootstrap roles in this account and can read the
 * configuration parameters synthesis needs. It cannot assume roles in workload accounts.
 * Only tokens from this repository can assume it.
 */
export class GitHubManagementDeployRoleStack extends cdk.Stack {
  /**
   * @param scope - The parent construct.
   * @param id - The construct id.
   * @param props - The management account, region, and GitHub OIDC provider.
   */
  constructor(
    scope: Construct,
    id: string,
    props: GitHubManagementDeployRoleStackProps,
  ) {
    super(scope, id, props);

    const provider = props.gitHubOidcProvider;
    const parameterPath = CONFIG_PARAMETER_PATH.replace(/^\//, "");

    const role = new Role(this, "GitHubManagementDeploy", {
      roleName: GITHUB_MANAGEMENT_DEPLOY_ROLE_NAME,
      description:
        "Assumed by this repository's deploy workflow to deploy the management account stacks.",
      assumedBy: new WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          [`${GITHUB_OIDC_HOST}:aud`]: GITHUB_OIDC_AUDIENCE,
        },
        StringLike: {
          [`${GITHUB_OIDC_HOST}:sub`]: GITHUB_OIDC_SUBJECT,
        },
      }),
    });

    role.addToPolicy(
      new PolicyStatement({
        actions: ["sts:AssumeRole", "sts:TagSession"],
        resources: CDK_BOOTSTRAP_ROLE_SUFFIXES.map(
          (suffix) =>
            `arn:aws:iam::${this.account}:role/cdk-${CDK_QUALIFIER}-${suffix}-${this.account}-*`,
        ),
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
        ],
        resources: [
          this.formatArn({
            service: "ssm",
            resource: "parameter",
            resourceName: parameterPath,
          }),
          this.formatArn({
            service: "ssm",
            resource: "parameter",
            resourceName: `${parameterPath}/*`,
          }),
        ],
      }),
    );

    new cdk.CfnOutput(this, "GitHubManagementDeployRoleArn", {
      value: role.roleArn,
      description:
        "Role the management deploy workflow assumes. Store this in the GitHub secret GH_MANAGEMENT_DEPLOY_ROLE_ARN.",
    });
  }
}
