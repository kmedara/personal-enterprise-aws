import { CfnOrganization } from "aws-cdk-lib/aws-organizations";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { WorkloadAccount } from "../account/workload-account";
import { ACCOUNT_NAMES } from "../constants";
import { OrgUnits } from "./org-units";

/** Name of the organizational unit that holds workload accounts. */
const WORKLOAD_OU_NAME = "workload";

/** Properties for {@link OrganizationStack}. */
export type OrganizationStackProps = cdk.StackProps & {
  /** Organizational unit names created directly under the organization root. */
  organizationalUnitNames: string[];
  /** Email address used to create the development workload account. */
  WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL: string;
};

/**
 * Creates the organization, its organizational units, and the development workload account.
 */
export class OrganizationStack extends cdk.Stack {
  /** Account id of the development workload account. */
  readonly developmentAccountId: string;
  /** Id of the workload organizational unit. */
  readonly workloadOuId: string;

  /**
   * @param scope - The parent construct.
   * @param id - The construct id.
   * @param props - Organization settings, including unit names and the development account email.
   */
  constructor(scope: Construct, id: string, props: OrganizationStackProps) {
    super(scope, id, props);

    const org = new CfnOrganization(this, "Organization", {
      featureSet: "ALL",
    });
    // Import requires a retain policy, and a later stack delete must not delete the organization.
    org.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    // const stackSetsAccess = this.enableStackSetsAccess();
    // stackSetsAccess.node.addDependency(org);

    const orgUnits = new OrgUnits(this, "OrgUnits", {
      rootId: org.attrRootId,
      names: props.organizationalUnitNames,
    });

    const workloadOu = orgUnits.byName.get(WORKLOAD_OU_NAME);
    if (!workloadOu) {
      throw new Error(`ORGANIZATIONAL_UNITS must include ${WORKLOAD_OU_NAME}.`);
    }

    const development = new WorkloadAccount(this, "DevelopmentWorkload", {
      email: props.WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL,
      accountName: ACCOUNT_NAMES["workload:development"],
      parentId: workloadOu.attrId,
    });
    this.developmentAccountId = development.account.attrAccountId;
    this.workloadOuId = workloadOu.attrId;

    new cdk.CfnOutput(this, "DevelopmentWorkloadAccountId", {
      value: this.developmentAccountId,
      description: "The ID of the development workload account",
    });
    new cdk.CfnOutput(this, "WorkloadOuId", {
      value: this.workloadOuId,
      description: "The ID of the workload organizational unit",
    });
  }
}
