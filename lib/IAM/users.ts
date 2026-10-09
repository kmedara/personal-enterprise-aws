import { CfnUser } from "aws-cdk-lib/aws-identitystore";
import { Construct } from "constructs";
import { GROUP_NAME, GROUP_NAMES } from "../constants";

/** A person who receives an Identity Center user. */
export type IdentityCenterUser = {
  /** Sign-in name. Also used as the construct id. */
  userName: string;
  /** Given name shown on the user profile. */
  givenName: string;
  /** Family name shown on the user profile. */
  familyName: string;
  /** Work email address. Marked as the primary email. */
  email: string;
};

/** Properties for {@link Users}. */
export type UsersProps = {
  /** Identity Store id that owns the users. */
  IDENTITY_STORE_ID: string;
  /** Users to create, grouped by Identity Center group name. */
  users: Record<GROUP_NAME, IdentityCenterUser[]>;
};

/** Creates Identity Center users and keeps them grouped by group name. */
export class Users extends Construct {
  /** Created users keyed by the group they belong to. */
  readonly users = new Map<GROUP_NAME, CfnUser[]>();
  /** Users already created in this construct, keyed by user name. */
  private readonly createdUsers = new Map<string, CfnUser>();

  /**
   * @param scope - The parent construct.
   * @param id - The construct id.
   * @param props - The Identity Store and the users to create.
   */
  constructor(scope: Construct, id: string, props: UsersProps) {
    super(scope, id);

    this.users.set(
      GROUP_NAMES.administrators,
      props.users.administrators.map((user) => this.createUser(props, user)),
    );
    this.users.set(
      GROUP_NAMES.developers,
      props.users.developers.map((user) => this.createUser(props, user)),
    );
  }

  /**
   * Creates an Identity Center user, reusing an existing user with the same user name.
   *
   * @param props - The Identity Store id and the user lists.
   * @param user - The user to create.
   * @returns The Identity Center user resource.
   */
  private createUser(props: UsersProps, user: IdentityCenterUser): CfnUser {
    const existing = this.createdUsers.get(user.userName);
    if (existing) {
      return existing;
    }

    const created = new CfnUser(this, user.userName, {
      identityStoreId: props.IDENTITY_STORE_ID,
      userName: user.userName,
      displayName: `${user.givenName} ${user.familyName}`,
      name: {
        givenName: user.givenName,
        familyName: user.familyName,
      },
      emails: [
        {
          value: user.email,
          type: "work",
          primary: true,
        },
      ],
    });
    this.createdUsers.set(user.userName, created);
    return created;
  }
}
