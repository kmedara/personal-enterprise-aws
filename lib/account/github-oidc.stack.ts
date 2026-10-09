import { OpenIdConnectProvider } from "aws-cdk-lib/aws-iam";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { GITHUB_OIDC_AUDIENCE, GITHUB_OIDC_HOST } from "./github-oidc";

/**
 * Creates the GitHub Actions OpenID Connect (OIDC) provider in the management account.
 *
 * The issuer URL can exist only once in the account. Role stacks trust this provider.
 * They do not create it.
 */
export class GitHubOidcStack extends cdk.Stack {
  /** Provider that management-account GitHub roles trust. */
  readonly provider: OpenIdConnectProvider;

  /**
   * @param scope - The parent construct.
   * @param id - The construct id.
   * @param props - The management account and region.
   */
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    this.provider = new OpenIdConnectProvider(this, "GitHubOidcProvider", {
      url: `https://${GITHUB_OIDC_HOST}`,
      clientIds: [GITHUB_OIDC_AUDIENCE],
    });
  }
}
