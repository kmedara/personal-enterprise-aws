import { CfnStackSet } from "aws-cdk-lib/aws-cloudformation";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

/** Role name created in each workload account. */
export const GITHUB_DEPLOY_ROLE_NAME = "github-deploy";

/** GitHub Actions OIDC issuer. The provider host is this URL without the scheme. */
const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";

/** Host used in the role trust policy condition keys. */
const GITHUB_OIDC_HOST = "token.actions.githubusercontent.com";

/**
 * Thumbprints CloudFormation still requires on the provider.
 * IAM ignores these for the GitHub Actions issuer and validates the certificate itself.
 */
const GITHUB_OIDC_THUMBPRINTS = [
  "6938fd4d98bab03faadb97b34396831e3780aea1",
  "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
];

/** Audience GitHub requests when it calls `AssumeRoleWithWebIdentity`. */
const GITHUB_OIDC_AUDIENCE = "sts.amazonaws.com";

/**
 * `owner/name` portion of a GitHub subject.
 * The owner cannot be a wildcard. The remainder can narrow a branch, tag, or environment.
 */
const GITHUB_SUBJECT_PATTERN =
  /^repo:[A-Za-z0-9_.@-]+\/[A-Za-z0-9_.@:+/*-]+$/;

/** Properties for {@link GitHubDeployRoleStack}. */
export type GitHubDeployRoleStackProps = cdk.StackProps & {
  /** Id of the workload organizational unit. */
  WORKLOAD_OU_ID: string;
  /** Account id of the development workload account. Used to publish the role ARN. */
  WORKLOAD_DEVELOPMENT_ACCOUNT_ID: string;
  /** Comma-separated GitHub OIDC subjects allowed to assume the role. */
  GITHUB_DEPLOY_SUBJECTS: string;
};

/**
 * Splits `GITHUB_DEPLOY_SUBJECTS` into trust-policy subjects.
 *
 * Each entry must name a GitHub owner, for example `repo:kmedara/app:*`.
 * A subject that can match every repository on GitHub is rejected.
 *
 * @param value - Comma-separated subjects from Parameter Store.
 * @returns The subjects to place on the role trust policy.
 */
export function parseGitHubDeploySubjects(value: string): string[] {
  const subjects = value
    .split(",")
    .map((subject) => subject.trim())
    .filter((subject) => subject.length > 0);
  if (subjects.length === 0) {
    throw new Error(
      "GITHUB_DEPLOY_SUBJECTS must list at least one repo:owner/name subject.",
    );
  }
  for (const subject of subjects) {
    const namesAnyRepository =
      subject.includes("repo:*") || subject.startsWith("repo:*/");
    if (!GITHUB_SUBJECT_PATTERN.test(subject) || namesAnyRepository) {
      throw new Error(
        `GITHUB_DEPLOY_SUBJECTS entry "${subject}" must name an owner, for example repo:kmedara/app:*.`,
      );
    }
  }
  return subjects;
}

/** Default Cloud Development Kit (CDK) bootstrap qualifier. */
const CDK_QUALIFIER = "hnb659fds";

/**
 * Bootstrap role name suffixes `github-deploy` is allowed to assume.
 * CloudFormation execution stays on the deploy role; this role does not receive it.
 */
const CDK_BOOTSTRAP_ROLE_SUFFIXES = [
  "deploy-role",
  "file-publishing-role",
  "image-publishing-role",
  "lookup-role",
];

/**
 * Template deployed into each workload account.
 *
 * `github-deploy` can assume the CDK bootstrap roles in the same account and region
 * pattern. Those roles perform the deploy. This role has no other permissions.
 */
function githubDeployTemplate(subjects: readonly string[]): string {
  return JSON.stringify({
    AWSTemplateFormatVersion: "2010-09-09",
    Resources: {
      GitHubOidcProvider: {
        Type: "AWS::IAM::OIDCProvider",
        Properties: {
          Url: GITHUB_OIDC_ISSUER,
          ClientIdList: [GITHUB_OIDC_AUDIENCE],
          ThumbprintList: GITHUB_OIDC_THUMBPRINTS,
        },
      },
      GitHubDeploy: {
        Type: "AWS::IAM::Role",
        DependsOn: "GitHubOidcProvider",
        Properties: {
          RoleName: GITHUB_DEPLOY_ROLE_NAME,
          Description:
            "Assumed by GitHub Actions to deploy applications in this workload account.",
          Policies: [
            {
              PolicyName: "AssumeCdkDeployRoles",
              PolicyDocument: {
                Version: "2012-10-17",
                Statement: [
                  {
                    Effect: "Allow",
                    Action: ["sts:AssumeRole", "sts:TagSession"],
                    Resource: CDK_BOOTSTRAP_ROLE_SUFFIXES.map((suffix) => ({
                      "Fn::Sub": `arn:aws:iam::\${AWS::AccountId}:role/cdk-${CDK_QUALIFIER}-${suffix}-\${AWS::AccountId}-*`,
                    })),
                  },
                ],
              },
            },
          ],
          AssumeRolePolicyDocument: {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: {
                  Federated: {
                    "Fn::Sub": `arn:aws:iam::\${AWS::AccountId}:oidc-provider/${GITHUB_OIDC_HOST}`,
                  },
                },
                Action: "sts:AssumeRoleWithWebIdentity",
                Condition: {
                  StringEquals: {
                    [`${GITHUB_OIDC_HOST}:aud`]: GITHUB_OIDC_AUDIENCE,
                  },
                  StringLike: {
                    [`${GITHUB_OIDC_HOST}:sub`]: subjects,
                  },
                },
              },
            ],
          },
        },
      },
    },
  });
}

/**
 * Deploys a GitHub Actions OIDC provider and the `github-deploy` role into every
 * account in the workload organizational unit.
 *
 * The stack stays in the management account. CloudFormation StackSets creates the
 * provider and role in the workload accounts. Accounts added to that unit later
 * receive the same role.
 */
export class GitHubDeployRoleStack extends cdk.Stack {
  /**
   * @param scope - The parent construct.
   * @param id - The construct id.
   * @param props - The workload unit, the development account id, and the GitHub subjects.
   */
  constructor(scope: Construct, id: string, props: GitHubDeployRoleStackProps) {
    super(scope, id, props);

    const subjects = parseGitHubDeploySubjects(props.GITHUB_DEPLOY_SUBJECTS);

    new CfnStackSet(this, "GitHubDeployRole", {
      stackSetName: "github-deploy-role",
      permissionModel: "SERVICE_MANAGED",
      callAs: "SELF",
      capabilities: ["CAPABILITY_NAMED_IAM"],
      templateBody: githubDeployTemplate(subjects),
      autoDeployment: {
        enabled: true,
        retainStacksOnAccountRemoval: false,
      },
      stackInstancesGroup: [
        {
          regions: [cdk.Stack.of(this).region],
          deploymentTargets: {
            organizationalUnitIds: [props.WORKLOAD_OU_ID],
          },
        },
      ],
    });

    new cdk.CfnOutput(this, "DevelopmentGitHubDeployRoleArn", {
      value: `arn:aws:iam::${props.WORKLOAD_DEVELOPMENT_ACCOUNT_ID}:role/${GITHUB_DEPLOY_ROLE_NAME}`,
      description:
        "Role GitHub Actions assumes to deploy into the development workload account.",
    });
  }
}
