import { CfnAccount } from "aws-cdk-lib/aws-organizations";
import { Construct } from "constructs";

/** Properties for {@link WorkloadAccount}. */
export type WorkloadAccountProps = {
  /** Email address of the new account. */
  email: string;
  /** Display name of the new account. */
  accountName: string;
  /** Id of the organizational unit that parents the account. */
  parentId: string;
};

/**
 * Creates an organization member account under one organizational unit.
 *
 * The management account can administer the member through `OrganizationAccountAccessRole`.
 */
export class WorkloadAccount extends Construct {
  /** The organization member account. */
  readonly account: CfnAccount;

  /**
   * @param scope - The parent construct.
   * @param id - The construct id.
   * @param props - The account email, name, and parent organizational unit.
   */
  constructor(scope: Construct, id: string, props: WorkloadAccountProps) {
    super(scope, id);

    this.account = new CfnAccount(this, "Account", {
      email: props.email,
      accountName: props.accountName,
      parentIds: [props.parentId],
      roleName: "OrganizationAccountAccessRole",
    });
  }
}
