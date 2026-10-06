import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { accountCatalogJson } from "../lib/account-catalog";
import { defineOrganization } from "../lib/define-organization";
import { loadOrganizationAccounts, type OrganizationAccounts } from "../lib/load-accounts";

const MANAGEMENT_ID = "111111111111";
const WORKLOAD_DEV_ID = "222222222222";

describe("organization accounts", () => {
  it("loads management and workload-dev from the account catalog", () => {
    const accounts = loadOrganizationAccounts(writeAccountsFile({
      managementId: MANAGEMENT_ID,
      workloadDevId: WORKLOAD_DEV_ID,
    }));

    assert.equal(accounts.management.id, MANAGEMENT_ID);
    assert.equal(accounts.management.organizationalUnitPath, "/");
    assert.equal(accounts.workloadDev.alias, "workload-dev");
    assert.equal(accounts.workloadDev.organizationalUnitPath, "/workload");
    assert.equal(accounts.region, "us-east-1");
  });

  it("lets context override account IDs", () => {
    const accounts = loadOrganizationAccounts(
      writeAccountsFile({ managementId: "", workloadDevId: "" }),
      {
        managementAccountId: MANAGEMENT_ID,
        workloadDevAccountId: WORKLOAD_DEV_ID,
      },
    );

    assert.equal(accounts.management.id, MANAGEMENT_ID);
    assert.equal(accounts.workloadDev.id, WORKLOAD_DEV_ID);
  });

  it("rejects a missing account ID", () => {
    assert.throws(
      () => loadOrganizationAccounts(writeAccountsFile({ managementId: "", workloadDevId: WORKLOAD_DEV_ID })),
      /accounts\.management\.id/,
    );
  });

  it("rejects duplicate account IDs", () => {
    assert.throws(
      () => loadOrganizationAccounts(writeAccountsFile({
        managementId: MANAGEMENT_ID,
        workloadDevId: MANAGEMENT_ID,
      })),
      /must be different/,
    );
  });
});

describe("organization stacks", () => {
  it("targets the existing accounts and does not create an organization or accounts", () => {
    const accounts = sampleAccounts();
    const stacks = defineOrganization(new App(), accounts);

    assert.equal(stacks.management.account, MANAGEMENT_ID);
    assert.equal(stacks.workloadDev.account, WORKLOAD_DEV_ID);
    assert.equal(stacks.management.region, "us-east-1");
    assert.equal(stacks.workloadDev.region, "us-east-1");

    const management = Template.fromStack(stacks.management);
    management.hasResourceProperties("AWS::SSM::Parameter", {
      Name: "/personal-enterprise/org/accounts",
      Type: "String",
      Value: accountCatalogJson(accounts),
    });
    management.hasResourceProperties("AWS::SSM::Parameter", {
      Name: "/personal-enterprise/account/alias",
      Value: "management",
    });
    management.resourceCountIs("AWS::Organizations::Organization", 0);
    management.resourceCountIs("AWS::Organizations::Account", 0);
    management.resourceCountIs("AWS::Organizations::OrganizationalUnit", 0);

    const workloadDev = Template.fromStack(stacks.workloadDev);
    workloadDev.hasResourceProperties("AWS::SSM::Parameter", {
      Name: "/personal-enterprise/account/alias",
      Value: "workload-dev",
    });
    workloadDev.hasResourceProperties("AWS::SSM::Parameter", {
      Name: "/personal-enterprise/account/organizational-unit-path",
      Value: "/workload",
    });
    workloadDev.resourceCountIs("AWS::SSM::Parameter", 2);
    workloadDev.resourceCountIs("AWS::Organizations::Organization", 0);
    workloadDev.resourceCountIs("AWS::Organizations::Account", 0);
  });
});

function sampleAccounts(): OrganizationAccounts {
  return loadOrganizationAccounts(writeAccountsFile({
    managementId: MANAGEMENT_ID,
    workloadDevId: WORKLOAD_DEV_ID,
  }));
}

function writeAccountsFile(ids: { managementId: string; workloadDevId: string }): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "personal-enterprise-"));
  const filePath = path.join(directory, "accounts.json");
  fs.writeFileSync(filePath, JSON.stringify({
    region: "us-east-1",
    accounts: {
      management: {
        id: ids.managementId,
        alias: "management",
        profile: "management",
        organizationalUnitPath: "/",
      },
      workloadDev: {
        id: ids.workloadDevId,
        alias: "workload-dev",
        profile: "workload-dev",
        organizationalUnitPath: "/workload",
      },
    },
  }));
  return filePath;
}
