import "server-only";
import { cookies } from "next/headers";

const authUserCookieKey = "gympal-user-id";

export function getServerUserId() {
  return cookies().get(authUserCookieKey)?.value;
}
