import type { OrganizationAccounts } from "./load-accounts";

export interface CatalogAccount {
  readonly id: string;
  readonly alias: string;
  readonly organizationalUnitPath: string;
}

export interface AccountCatalog {
  readonly management: CatalogAccount;
  readonly workloadDev: CatalogAccount;
}

export function accountCatalog(accounts: OrganizationAccounts): AccountCatalog {
  return {
    management: toCatalogAccount(accounts.management),
    workloadDev: toCatalogAccount(accounts.workloadDev),
  };
}

export function accountCatalogJson(accounts: OrganizationAccounts): string {
  return JSON.stringify(accountCatalog(accounts));
}

function toCatalogAccount(account: OrganizationAccounts["management"]): CatalogAccount {
  return {
    id: account.id,
    alias: account.alias,
    organizationalUnitPath: account.organizationalUnitPath,
  };
}
