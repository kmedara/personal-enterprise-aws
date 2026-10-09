import { parseUsers } from "../lib/IAM/load-users";

const USERS = {
  administrators: [
    {
      userName: "ada",
      givenName: "Ada",
      familyName: "Lovelace",
      email: "ada@example.com",
    },
  ],
  developers: [
    {
      userName: "ada",
      givenName: "Ada",
      familyName: "Lovelace",
      email: "ada@example.com",
    },
  ],
};

test("parses administrators and developers from the parameter value", () => {
  expect(parseUsers(JSON.stringify(USERS))).toEqual(USERS);
});

test("rejects a catalog that omits a group or a user field", () => {
  expect(() => parseUsers("{")).toThrow(/must be JSON/);
  expect(() => parseUsers(JSON.stringify({ administrators: [] }))).toThrow(
    /administrators and developers/,
  );
  expect(() =>
    parseUsers(
      JSON.stringify({
        administrators: [{ userName: "ada" }],
        developers: [],
      }),
    ),
  ).toThrow(/administrators and developers/);
});
