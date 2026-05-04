const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const accessTokenSource = readFileSync(join(process.cwd(), "lib", "access-token.ts"), "utf8");
const apiSource = readFileSync(join(process.cwd(), "lib", "api.ts"), "utf8");
const authSource = readFileSync(join(process.cwd(), "lib", "auth.ts"), "utf8");
const serverAuthSource = readFileSync(join(process.cwd(), "lib", "server-auth.ts"), "utf8");

test("auth token helpers treat missing, malformed, and expired JWTs as unauthenticated", () => {
  assert.match(accessTokenSource, /decodeAccessTokenPayload/, "access token payload decoding should be explicit");
  assert.match(accessTokenSource, /typeof payload\?\.exp !== "number"/, "tokens without exp should not be trusted");
  assert.match(accessTokenSource, /payload\.exp <= Math\.floor\(Date\.now\(\) \/ 1000\) \+ skewSeconds/, "exp should be checked with clock skew");
});

test("server and client auth paths reject expired tokens before protected data requests", () => {
  assert.match(serverAuthSource, /isAccessTokenExpired\(token\)/, "server auth should validate cookie expiry");
  assert.match(serverAuthSource, /return undefined/, "expired server tokens should be treated as absent");
  assert.match(authSource, /isAccessTokenExpired\(session\.token\)/, "stored sessions should be expiry checked");
  assert.match(authSource, /isAccessTokenExpired\(cookieToken\)/, "auth cookies should be expiry checked");
  assert.match(authSource, /clearAuthSession\(\)/, "expired client sessions should be cleared locally");
});

test("API auth failures clear stale client session state", () => {
  assert.match(apiSource, /isAuthFailure\(response\.status, detail\)/, "API requests should detect auth failures");
  assert.match(apiSource, /clearAuthSession\(\)/, "auth failures should clear stale session data");
  assert.match(apiSource, /Authentication required\. Please sign in again\./, "auth failures should surface a reusable session-expired message");
});
