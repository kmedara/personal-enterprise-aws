/** GitHub repository that owns the management-account workflows. */
export const GITHUB_REPOSITORY = "kmedara/personal-enterprise-aws";

/** Numeric owner id embedded in this repository's immutable OIDC subject. */
export const GITHUB_OWNER_ID = "27218108";

/** Numeric repository id embedded in this repository's immutable OIDC subject. */
export const GITHUB_REPOSITORY_ID = "1407621766";

const [githubOwner, githubRepositoryName] = GITHUB_REPOSITORY.split("/");

/**
 * Subject claim GitHub sends for this repository.
 * Repositories created after July 15, 2026 include the owner and repository ids.
 */
export const GITHUB_OIDC_SUBJECT = `repo:${githubOwner}@${GITHUB_OWNER_ID}/${githubRepositoryName}@${GITHUB_REPOSITORY_ID}:*`;

/** Host of the GitHub Actions OpenID Connect (OIDC) issuer. */
export const GITHUB_OIDC_HOST = "token.actions.githubusercontent.com";

/** Audience GitHub requests when it calls `AssumeRoleWithWebIdentity`. */
export const GITHUB_OIDC_AUDIENCE = "sts.amazonaws.com";
