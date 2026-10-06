import fs from "node:fs";
import path from "node:path";

export interface AccountSpec {
  readonly key: "management" | "workloadDev";
  readonly id: string;
  readonly alias: string;
  readonly profile: string;
  readonly organizationalUnitPath: string;
  readonly region: string;
}

export interface OrganizationAccounts {
  readonly region: string;
  readonly management: AccountSpec;
  readonly workloadDev: AccountSpec;
}

export interface AccountOverrides {
  readonly region?: string;
  readonly managementAccountId?: string;
  readonly workloadDevAccountId?: string;
}

interface AccountFileEntry {
  id: string;
  alias: string;
  profile: string;
  organizationalUnitPath: string;
}

interface AccountsFile {
  region: string;
  accounts: {
    management: AccountFileEntry;
    workloadDev: AccountFileEntry;
  };
}

const ACCOUNT_ID = /^\d{12}$/;
const REGION = /^[a-z]{2}-[a-z]+-\d+$/;

export function loadOrganizationAccounts(
  filePath: string,
  overrides: AccountOverrides = {},
): OrganizationAccounts {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as AccountsFile;
  const region = overrides.region || raw.region;
  if (!REGION.test(region)) {
    throw new Error(`Region "${region}" is not a valid AWS region.`);
  }

  const management = normalizeAccount(
    "management",
    raw.accounts.management,
    region,
    overrides.managementAccountId,
    filePath,
  );
  const workloadDev = normalizeAccount(
    "workloadDev",
    raw.accounts.workloadDev,
    region,
    overrides.workloadDevAccountId,
    filePath,
  );

  if (management.id === workloadDev.id) {
    throw new Error("Management and workload-dev account IDs must be different.");
  }

  return { region, management, workloadDev };
}

function normalizeAccount(
  key: AccountSpec["key"],
  account: AccountFileEntry,
  region: string,
  overrideId: string | undefined,
  filePath: string,
): AccountSpec {
  const id = overrideId || account.id;
  const fileName = path.basename(filePath);
  if (!ACCOUNT_ID.test(id)) {
    const contextKey = key === "management" ? "managementAccountId" : "workloadDevAccountId";
    throw new Error(
      `Set accounts.${key}.id in ${fileName} to the 12-digit AWS account ID, or pass --context ${contextKey}=<account-id>.`,
    );
  }

  if (!account.alias.trim() || !account.profile.trim()) {
    throw new Error(`accounts.${key} in ${fileName} needs an alias and a CLI profile.`);
  }

  if (!account.organizationalUnitPath.startsWith("/")) {
    throw new Error(
      `accounts.${key}.organizationalUnitPath in ${fileName} must start with "/" (use "/" for the org root).`,
    );
  }

  return {
    key,
    id,
    alias: account.alias,
    profile: account.profile,
    organizationalUnitPath: account.organizationalUnitPath,
    region,
  };
}
