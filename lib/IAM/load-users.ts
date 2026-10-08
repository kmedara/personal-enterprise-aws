import { readFileSync } from "node:fs";
import { IdentityCenterUser } from "./users";
import { GROUP_NAME } from "../constants";

/** Path to the Identity Center user catalog. */
const USERS_PATH = "config/users.json";

/**
 * Loads Identity Center users grouped by group name from `config/users.json`.
 *
 * @returns Users for each group.
 * @throws When the file is not an object whose properties are arrays.
 */
export function loadUsers(): Record<GROUP_NAME, IdentityCenterUser[]> {
  const parsed: unknown = JSON.parse(readFileSync(USERS_PATH, "utf8"));
  if (!isObjectWithArrayPropertiesOf<IdentityCenterUser>(parsed)) {
    throw new Error(`${USERS_PATH} must contain an object of users.`);
  }
  return parsed;
}

/**
 * Checks that a value is an object whose properties are arrays.
 *
 * The check does not validate the shape of each array item.
 *
 * @param value - The value to check.
 * @returns Whether the value matches the user catalog shape.
 */
const isObjectWithArrayPropertiesOf = <T>(
  value: unknown,
): value is Record<GROUP_NAME, T[]> => {
  return (
    typeof value === "object" &&
    value !== null &&
    value !== undefined &&
    Object.keys(value).every((key) =>
      Array.isArray(value[key as GROUP_NAME as keyof typeof value]),
    )
  );
};
