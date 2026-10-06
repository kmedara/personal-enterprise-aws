import { Tags, type App } from "aws-cdk-lib";
import type { OrganizationAccounts } from "./load-accounts";
import { ManagementBaselineStack } from "./management-baseline-stack";
import { WorkloadDevBaselineStack } from "./workload-dev-baseline-stack";

export interface OrganizationStacks {
  readonly management: ManagementBaselineStack;
  readonly workloadDev: WorkloadDevBaselineStack;
}

export function defineOrganization(app: App, accounts: OrganizationAccounts): OrganizationStacks {
  const management = new ManagementBaselineStack(app, "Management", { accounts });
  const workloadDev = new WorkloadDevBaselineStack(app, "WorkloadDev", {
    accountSpec: accounts.workloadDev,
  });

  Tags.of(app).add("Project", "personal-enterprise");
  Tags.of(app).add("ManagedBy", "cdk");
  Tags.of(management).add("AccountAlias", accounts.management.alias);
  Tags.of(workloadDev).add("AccountAlias", accounts.workloadDev.alias);

  return { management, workloadDev };
}
