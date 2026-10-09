import { CfnStackSet } from "aws-cdk-lib/aws-cloudformation";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

/** Properties for {@link DeveloperRoleStack}. */
export type DeveloperRoleStackProps = cdk.StackProps & {
  /** Account id of the development workload account. */
  WORKLOAD_DEVELOPMENT_ACCOUNT_ID: string;
  /** Id of the workload organizational unit. */
  WORKLOAD_OU_ID: string;
};

/**
 * CloudFormation template that creates the `developer` role.
 *
 * The role grants power-user access. Only the Identity Center developer permission set
 * in the same account can assume it.
 */
const DEVELOPER_ROLE_TEMPLATE = JSON.stringify({
  AWSTemplateFormatVersion: "2010-09-09",
  Resources: {
    Developer: {
      Type: "AWS::IAM::Role",
      Properties: {
        RoleName: "developer",
        ManagedPolicyArns: ["arn:aws:iam::aws:policy/PowerUserAccess"],
        AssumeRolePolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                AWS: { "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:root" },
              },
              Action: "sts:AssumeRole",
              Condition: {
                ArnLike: {
                  "aws:PrincipalArn": {
                    "Fn::Sub":
                      "arn:aws:iam::${AWS::AccountId}:role/aws-reserved/sso.amazonaws.com/*/AWSReservedSSO_DeveloperAccess_*",
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
});

/**
 * Deploys the `developer` role into the development workload account.
 *
 * The workload account id is only known after the organization deploys, so this stack
 * stays in the management account. CloudFormation StackSets creates the role in the
 * workload account.
 */
export class DeveloperRoleStack extends cdk.Stack {
  /**
   * @param scope - The parent construct.
   * @param id - The construct id.
   * @param props - The development account id and the workload organizational unit id.
   */
  constructor(scope: Construct, id: string, props: DeveloperRoleStackProps) {
    super(scope, id, props);

    // The workload account id is only known after Organization deploys, so this stack
    // stays in the management account and StackSets creates the role in the workload account.
    new CfnStackSet(this, "DeveloperRole", {
      stackSetName: "developer-role",
      permissionModel: "SERVICE_MANAGED",
      callAs: "SELF",
      capabilities: ["CAPABILITY_NAMED_IAM"],
      templateBody: DEVELOPER_ROLE_TEMPLATE,
      autoDeployment: {
        enabled: false,
      },
      stackInstancesGroup: [
        {
          regions: [cdk.Stack.of(this).region],
          deploymentTargets: {
            organizationalUnitIds: [props.WORKLOAD_OU_ID],
            accounts: [props.WORKLOAD_DEVELOPMENT_ACCOUNT_ID],
            accountFilterType: "INTERSECTION",
          },
        },
      ],
    });
  }
}
