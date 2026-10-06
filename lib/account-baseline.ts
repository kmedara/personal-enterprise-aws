import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import type { AccountSpec } from "./load-accounts";

export interface AccountBaselineProps {
  readonly account: AccountSpec;
}

export class AccountBaseline extends Construct {
  public constructor(scope: Construct, id: string, props: AccountBaselineProps) {
    super(scope, id);

    new StringParameter(this, "Alias", {
      parameterName: "/personal-enterprise/account/alias",
      stringValue: props.account.alias,
      description: "Account alias recorded by the personal-enterprise CDK app.",
    });

    new StringParameter(this, "OrganizationalUnitPath", {
      parameterName: "/personal-enterprise/account/organizational-unit-path",
      stringValue: props.account.organizationalUnitPath,
      description: "OU path for this account, from the organization root.",
    });
  }
}
