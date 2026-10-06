import { Stack, type StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { AccountBaseline } from "./account-baseline";
import type { AccountSpec } from "./load-accounts";

export interface WorkloadDevBaselineStackProps extends StackProps {
  readonly accountSpec: AccountSpec;
}

export class WorkloadDevBaselineStack extends Stack {
  public constructor(scope: Construct, id: string, props: WorkloadDevBaselineStackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.accountSpec.id,
        region: props.accountSpec.region,
      },
      description: "Workload dev account baseline for the existing workload-dev account.",
    });

    if (props.accountSpec.key !== "workloadDev") {
      throw new Error("WorkloadDevBaseline only deploys the workload-dev account.");
    }

    new AccountBaseline(this, "Baseline", { account: props.accountSpec });
  }
}
