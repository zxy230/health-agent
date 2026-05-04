interface AccessTokenPayload {
  exp?: number;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

export function decodeAccessTokenPayload(token: string): AccessTokenPayload | null {
  const payloadSegment = token.split(".")[1];

  if (!payloadSegment) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadSegment)) as AccessTokenPayload;
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

export function isAccessTokenExpired(token: string | null | undefined, skewSeconds = 5) {
  if (!token) {
    return true;
  }

  const payload = decodeAccessTokenPayload(token);

  if (typeof payload?.exp !== "number") {
    return true;
  }

  return payload.exp <= Math.floor(Date.now() / 1000) + skewSeconds;
}
