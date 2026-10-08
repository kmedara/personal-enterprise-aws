import { CfnPermissionSet } from "aws-cdk-lib/aws-sso";
import { Construct } from "constructs";

/** Managed policy Amazon Resource Names (ARNs) attached to administrator access. */
const ADMINISTRATOR_MANAGED_POLICIES = [
  "arn:aws:iam::aws:policy/AdministratorAccess",
  "arn:aws:iam::aws:policy/job-function/Billing",
  "arn:aws:iam::aws:policy/AWSBillingReadOnlyAccess",
  "arn:aws:iam::aws:policy/AWSBillingConductorReadOnlyAccess",
  "arn:aws:iam::aws:policy/AWSAccountUsageReportAccess",
  "arn:aws:iam::aws:policy/CostOptimizationHubAdminAccess",
  "arn:aws:iam::aws:policy/CostOptimizationHubReadOnlyAccess",
  "arn:aws:iam::aws:policy/service-role/AWSCostAndUsageReportAutomationPolicy",
];

/** Properties for {@link PermissionSets}. */
export type PermissionSetsProps = {
  /** ARN of the Identity Center instance. */
  INSTANCE_ARN: string;
  /** Account id of the development workload account. */
  WORKLOAD_DEVELOPMENT_ACCOUNT_ID: string;
};

/**
 * Identity Center permission sets for administrators and developers.
 *
 * Developer access can assume the `developer` role in the development workload account.
 */
export class PermissionSets extends Construct {
  /** Full administrator access, plus billing and cost policies. Session length is one hour. */
  readonly administratorAccess: CfnPermissionSet;
  /** Read-only access, plus permission to assume the workload `developer` role. Session length is eight hours. */
  readonly developerAccess: CfnPermissionSet;

  /**
   * @param scope - The parent construct.
   * @param id - The construct id.
   * @param props - The Identity Center instance and the development account id.
   */
  constructor(scope: Construct, id: string, props: PermissionSetsProps) {
    super(scope, id);

    this.administratorAccess = new CfnPermissionSet(
      this,
      "AdministratorAccess",
      {
        instanceArn: props.INSTANCE_ARN,
        name: "AdministratorAccess",
        sessionDuration: "PT1H",
        managedPolicies: ADMINISTRATOR_MANAGED_POLICIES,
      },
    );

    this.developerAccess = new CfnPermissionSet(this, "DeveloperAccess", {
      instanceArn: props.INSTANCE_ARN,
      name: "DeveloperAccess",
      sessionDuration: "PT8H",
      managedPolicies: ["arn:aws:iam::aws:policy/ReadOnlyAccess"],
      inlinePolicy: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AssumeBalanceRoles",
            Effect: "Allow",
            Action: "sts:AssumeRole",
            Resource: [
              `arn:aws:iam::${props.WORKLOAD_DEVELOPMENT_ACCOUNT_ID}:role/developer`,
            ],
          },
        ],
      },
    });
  }
}
