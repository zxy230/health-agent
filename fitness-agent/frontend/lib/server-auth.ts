import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAccessTokenExpired } from "@/lib/access-token";
import { appRoutes } from "@/lib/routes";

const authTokenCookieKey = "gympal-access-token";

export function getServerAuthToken() {
  const token = cookies().get(authTokenCookieKey)?.value;

  if (isAccessTokenExpired(token)) {
    return undefined;
  }

  return token;
}

export function requireServerAuthToken() {
  const token = getServerAuthToken();

  if (!token) {
    redirect(appRoutes.login);
  }

  return token;
}
