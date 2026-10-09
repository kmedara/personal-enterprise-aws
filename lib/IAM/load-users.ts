import { GROUP_NAME, GROUP_NAMES } from "../constants";
import { IdentityCenterUser } from "./users";

/**
 * Parses the `IDENTITY_CENTER_USERS` parameter into users grouped by group name.
 *
 * @param value - JSON object stored in Parameter Store.
 * @returns Users for each group.
 * @throws When the value is not a catalog of administrators and developers.
 */
export function parseUsers(value: string): Record<GROUP_NAME, IdentityCenterUser[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("IDENTITY_CENTER_USERS must be JSON.");
  }
  if (!isUserCatalog(parsed)) {
    throw new Error(
      "IDENTITY_CENTER_USERS must contain administrators and developers arrays of users with userName, givenName, familyName, and email.",
    );
  }
  return parsed;
}

/**
 * Checks that a value is the Identity Center user catalog.
 *
 * @param value - The parsed parameter value.
 * @returns Whether both groups are arrays of users.
 */
function isUserCatalog(
  value: unknown,
): value is Record<GROUP_NAME, IdentityCenterUser[]> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const catalog = value as Record<string, unknown>;
  return (Object.values(GROUP_NAMES) as GROUP_NAME[]).every((groupName) => {
    const users = catalog[groupName];
    return Array.isArray(users) && users.every(isUser);
  });
}

/**
 * Checks that a value has the fields required to create an Identity Center user.
 *
 * @param value - One catalog entry.
 * @returns Whether the entry is a user.
 */
function isUser(value: unknown): value is IdentityCenterUser {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const user = value as Record<string, unknown>;
  return ["userName", "givenName", "familyName", "email"].every(
    (field) => typeof user[field] === "string" && user[field].trim().length > 0,
  );
}
