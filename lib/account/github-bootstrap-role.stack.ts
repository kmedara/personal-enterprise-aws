import {
  PolicyStatement,
  Role,
  WebIdentityPrincipal,
  type IOpenIdConnectProvider,
} from "aws-cdk-lib/aws-iam";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import {
  GITHUB_OIDC_AUDIENCE,
  GITHUB_OIDC_HOST,
  GITHUB_OIDC_SUBJECT,
  GITHUB_REPOSITORY,
} from "./github-oidc";

/** Role in the management account that bootstraps workload accounts. */
export const GITHUB_BOOTSTRAP_ROLE_NAME = "github-bootstrap";

/** GitHub repository allowed to assume {@link GITHUB_BOOTSTRAP_ROLE_NAME}. */
export const GITHUB_BOOTSTRAP_REPOSITORY = GITHUB_REPOSITORY;

/** Properties for {@link GitHubBootstrapRoleStack}. */
export type GitHubBootstrapRoleStackProps = cdk.StackProps & {
  /** Id of the organization, used to limit which accounts the role can administer. */
  ORGANIZATION_ID: string;
  /** Id of the organization root. */
  ROOT_ID: string;
  /** Id of the workload organizational unit. */
  WORKLOAD_OU_ID: string;
  /** GitHub OIDC provider created by the provider stack. */
  gitHubOidcProvider: IOpenIdConnectProvider;
};

/**
 * Creates a GitHub Actions role in the management account for bootstrapping workload accounts.
 *
 * The role can assume `OrganizationAccountAccessRole` only in accounts under the workload
 * organizational unit. Only tokens from this repository can assume the role.
 */
export class GitHubBootstrapRoleStack extends cdk.Stack {
  /**
   * @param scope - The parent construct.
   * @param id - The construct id.
   * @param props - Organization ids that bound the accounts this role can bootstrap.
   */
  constructor(
    scope: Construct,
    id: string,
    props: GitHubBootstrapRoleStackProps,
  ) {
    super(scope, id, props);

    const provider = props.gitHubOidcProvider;

    const role = new Role(this, "GitHubBootstrap", {
      roleName: GITHUB_BOOTSTRAP_ROLE_NAME,
      description:
        "Assumed by this repository's bootstrap workflow to bootstrap workload accounts.",
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
        actions: ["sts:AssumeRole"],
        resources: ["arn:aws:iam::*:role/OrganizationAccountAccessRole"],
        conditions: {
          "ForAnyValue:StringLike": {
            "aws:ResourceOrgPaths": [
              `${props.ORGANIZATION_ID}/${props.ROOT_ID}/${props.WORKLOAD_OU_ID}/*`,
            ],
          },
        },
      }),
    );

    new cdk.CfnOutput(this, "GitHubBootstrapRoleArn", {
      value: role.roleArn,
      description:
          "Role the bootstrap workflow assumes in the management account. Store this in the GitHub secret GH_WORKLOAD_BOOTSTRAP_ROLE_ARN.",
      });
  }
}
