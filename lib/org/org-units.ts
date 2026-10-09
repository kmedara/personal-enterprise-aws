import { CfnOrganizationalUnit } from "aws-cdk-lib/aws-organizations";
import { Construct } from "constructs";

/** Properties for {@link OrgUnits}. */
export type OrgUnitsProps = {
  /** Id of the organization root that parents the new units. */
  rootId: string;
  /** Names of the organizational units to create. */
  names: string[];
};

/** Creates one organizational unit for each requested name. */
export class OrgUnits extends Construct {
  /** Organizational units keyed by name. */
  readonly byName = new Map<string, CfnOrganizationalUnit>();

  /**
   * @param scope - The parent construct.
   * @param id - The construct id.
   * @param props - The organization root and the unit names.
   */
  constructor(scope: Construct, id: string, props: OrgUnitsProps) {
    super(scope, id);

    for (const name of props.names) {
      const unit = new CfnOrganizationalUnit(this, `${name}Ou`, {
        name,
        parentId: props.rootId,
      });
      this.byName.set(name, unit);
    }
  }
}
