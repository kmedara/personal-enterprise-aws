/**
 * Account name used to look up an account id.
 *
 * `workload:staging` is the staging workload account.
 * `management` is the organization management account.
 */
export type ACCOUNT_NAME = "workload:staging" | "management";

/** Account names keyed by themselves so call sites can use a named constant. */
export const ACCOUNT_NAMES: Record<ACCOUNT_NAME, ACCOUNT_NAME> = {
  "workload:staging": "workload:staging",
  management: "management",
};

/** Identity Center group name. */
export type GROUP_NAME = "administrators" | "developers";

/** Identity Center group names keyed by themselves so call sites can use a named constant. */
export const GROUP_NAMES: Record<GROUP_NAME, GROUP_NAME> = {
  administrators: "administrators",
  developers: "developers",
};
