import { CfnGroup, CfnGroupMembership } from "aws-cdk-lib/aws-identitystore";
import { CfnAssignment, CfnPermissionSet } from "aws-cdk-lib/aws-sso";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { ACCOUNT_NAME, GROUP_NAME, GROUP_NAMES } from "../constants";
import { Groups } from "./groups";
import { PermissionSets } from "./permission-sets";
import { IdentityCenterUser, Users } from "./users";

/** Properties for {@link IdentityCenterStack}. */
export type IdentityCenterStackProps = cdk.StackProps & {
  /** Amazon Resource Name (ARN) of the Identity Center instance. */
  IDENTITY_CENTER_INSTANCE_ARN: string;
  /** Identity Store id that holds users and groups. */
  IDENTITY_STORE_ID: string;
  /** Account ids keyed by account name. */
  accountIds: Record<ACCOUNT_NAME, string>;
  /** Users to create, grouped by Identity Center group name. */
  users: Record<GROUP_NAME, IdentityCenterUser[]>;
};

/**
 * Creates Identity Center users, groups, permission sets, and account assignments.
 *
 * Administrators receive administrator access in the management account and the development
 * workload account. Developers receive developer access in the development workload account.
 */
export class IdentityCenterStack extends cdk.Stack {
  /**
   * @param scope - The parent construct.
   * @param id - The construct id.
   * @param props - Identity Center ids and the account ids that receive assignments.
   */
  constructor(scope: Construct, id: string, props: IdentityCenterStackProps) {
    super(scope, id, props);

    const users = new Users(this, "Users", {
      IDENTITY_STORE_ID: props.IDENTITY_STORE_ID,
      users: props.users,
    });
    const groups = new Groups(this, "Groups", {
      IDENTITY_STORE_ID: props.IDENTITY_STORE_ID,
    });
    const permissionSets = new PermissionSets(this, "PermissionSets", {
      INSTANCE_ARN: props.IDENTITY_CENTER_INSTANCE_ARN,
      WORKLOAD_DEVELOPMENT_ACCOUNT_ID: props.accountIds["workload:staging"],
    });

    this.addMemberships(
      users,
      GROUP_NAMES.administrators,
      groups.administrators,
      props.IDENTITY_STORE_ID,
    );
    this.addMemberships(
      users,
      GROUP_NAMES.developers,
      groups.developers,
      props.IDENTITY_STORE_ID,
    );

    this.assign(
      "AdministratorsManagementAssignment",
      props.IDENTITY_CENTER_INSTANCE_ARN,
      permissionSets.administratorAccess,
      groups.administrators,
      props.accountIds.management,
    );
    this.assign(
      "AdministratorsWorkloadAssignment",
      props.IDENTITY_CENTER_INSTANCE_ARN,
      permissionSets.administratorAccess,
      groups.administrators,
      props.accountIds["workload:staging"],
    );
    this.assign(
      "DevelopersWorkloadAssignment",
      props.IDENTITY_CENTER_INSTANCE_ARN,
      permissionSets.developerAccess,
      groups.developers,
      props.accountIds["workload:staging"],
    );
  }

  /**
   * Adds each user in a group to that Identity Center group.
   *
   * @param users - Users grouped by Identity Center group name.
   * @param groupName - The group whose users receive membership.
   * @param group - The Identity Center group resource.
   * @param identityStoreId - The Identity Store that owns the group.
   */
  private addMemberships(
    users: Users,
    groupName: (typeof GROUP_NAMES)[keyof typeof GROUP_NAMES],
    group: CfnGroup,
    identityStoreId: string,
  ): void {
    users.users.get(groupName)?.forEach((user) => {
      new CfnGroupMembership(
        this,
        `${user.node.id}${group.node.id}Membership`,
        {
          identityStoreId,
          groupId: group.attrGroupId,
          memberId: {
            userId: user.attrUserId,
          },
        },
      );
    });
  }

  /**
   * Assigns a permission set to a group in one account.
   *
   * @param id - The CloudFormation logical id of the assignment.
   * @param instanceArn - The ARN of the Identity Center instance.
   * @param permissionSet - The permission set to assign.
   * @param group - The group that receives the permission set.
   * @param accountId - The account where the assignment applies.
   */
  private assign(
    id: string,
    instanceArn: string,
    permissionSet: CfnPermissionSet,
    group: CfnGroup,
    accountId: string,
  ): void {
    new CfnAssignment(this, id, {
      instanceArn,
      permissionSetArn: permissionSet.attrPermissionSetArn,
      principalId: group.attrGroupId,
      principalType: "GROUP",
      targetId: accountId,
      targetType: "AWS_ACCOUNT",
    });
  }
}
