import { Stack, type StackProps } from "aws-cdk-lib";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { AccountBaseline } from "./account-baseline";
import { accountCatalogJson } from "./account-catalog";
import type { OrganizationAccounts } from "./load-accounts";

export interface ManagementBaselineStackProps extends StackProps {
  readonly accounts: OrganizationAccounts;
}

export class ManagementBaselineStack extends Stack {
  public constructor(scope: Construct, id: string, props: ManagementBaselineStackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.accounts.management.id,
        region: props.accounts.management.region,
      },
      description: "Management account baseline. References the existing organization; it does not create accounts.",
    });

    new AccountBaseline(this, "Baseline", { account: props.accounts.management });

    new StringParameter(this, "AccountCatalog", {
      parameterName: "/personal-enterprise/org/accounts",
      stringValue: accountCatalogJson(props.accounts),
      description: "Catalog of existing organization accounts managed by this CDK app.",
    });
  }
}
