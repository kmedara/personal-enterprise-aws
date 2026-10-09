/**
 * Systems Manager Parameter Store path that holds {@link Environment}.
 * Each value is one `String` parameter directly under this path.
 */
export const CONFIG_PARAMETER_PATH = "/personal-enterprise/config";

/** Configuration required to synthesize the organization. */
export interface Environment {
  /** Twelve-digit id of the organization management account. */
  MGMT_ACCOUNT_ID: string;
  /** Email address of the organization management account. */
  MGMT_ACCOUNT_EMAIL: string;
  /** Email address used to create the development workload account. */
  WORKLOAD_DEVELOPMENT_ACCOUNT_EMAIL: string;
  /** Amazon Resource Name (ARN) of the Identity Center instance. */
  IDENTITY_CENTER_INSTANCE_ARN: string;
  /** Identity Store id that holds Identity Center users and groups. */
  IDENTITY_STORE_ID: string;
  /** Comma-separated organizational unit names created under the organization root. */
  ORGANIZATIONAL_UNITS: string;
  /**
   * Comma-separated GitHub Actions OIDC subjects allowed to assume `github-deploy`
   * in workload accounts. Each entry names an owner, for example `repo:kmedara/app:*`.
   */
  GITHUB_DEPLOY_SUBJECTS: string;
  /**
   * JSON object of Identity Center users grouped by `administrators` and `developers`.
   */
  IDENTITY_CENTER_USERS: string;
}
