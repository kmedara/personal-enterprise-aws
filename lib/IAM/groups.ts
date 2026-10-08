import { CfnGroup } from "aws-cdk-lib/aws-identitystore";
import { Construct } from "constructs";
import { GROUP_NAMES } from "../constants";

/** Properties for {@link Groups}. */
export type GroupsProps = {
  /** Identity Store id that owns the groups. */
  IDENTITY_STORE_ID: string;
};

/** Identity Center groups for administrators and developers. */
export class Groups extends Construct {
  /** Group for organization administrators. */
  readonly administrators: CfnGroup;
  /** Group for workload developers. */
  readonly developers: CfnGroup;

  /**
   * @param scope - The parent construct.
   * @param id - The construct id.
   * @param props - The Identity Store that owns the groups.
   */
  constructor(scope: Construct, id: string, props: GroupsProps) {
    super(scope, id);

    this.administrators = new CfnGroup(this, "Administrators", {
      identityStoreId: props.IDENTITY_STORE_ID,
      displayName: GROUP_NAMES.administrators,
      description: "org admins",
    });

    this.developers = new CfnGroup(this, "Developers", {
      identityStoreId: props.IDENTITY_STORE_ID,
      displayName: GROUP_NAMES.developers,
    });
  }
}
