// lib/siws.ts
// Helpers for "Sign In With Solana" style wallet login (CAIP-122 / EIP-4361 text format).
// The server builds the message and stores it with a one-time nonce.
// The wallet signs exactly that text, so the signature is bound to this site,
// this wallet and a short expiry.

export const NONCE_TTL_MS = 5 * 60 * 1000;

export type SiteInfo = {
  /** Host shown in the message, for example "nector.chat" */
  domain: string;
  /** Origin shown in the URI line, for example "https://nector.chat" */
  origin: string;
};

/**
 * Which site this login belongs to.
 *
 * The domain is never taken from client-controlled request headers.
 *  - NEXT_PUBLIC_SITE_URL (set it in production) fixes the domain. It must
 *    match the host users actually open, for example https://www.nector.chat
 *    if the site serves on www.
 *  - Vercel preview deployments use VERCEL_URL, which Vercel sets itself.
 *  - Local development (NODE_ENV !== "production") may use the Host header,
 *    but only for localhost.
 * Anything else returns null and the API answers SITE_NOT_CONFIGURED.
 */
export function getSiteInfo(req: Request): SiteInfo | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      return { domain: url.host, origin: url.origin };
    } catch {
      return null;
    }
  }

  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return {
      domain: process.env.VERCEL_URL,
      origin: `https://${process.env.VERCEL_URL}`,
    };
  }

  if (process.env.NODE_ENV !== "production") {
    const host = (req.headers.get("host") ?? "").trim();
    if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
      return { domain: host, origin: `http://${host}` };
    }
  }

  return null;
}

export function buildSignInMessage(params: {
  domain: string;
  origin: string;
  address: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}): string {
  const { domain, origin, address, nonce, issuedAt, expiresAt } = params;

  return [
    `${domain} wants you to sign in with your Solana account:`,
    address,
    "",
    "Sign in to Nector. This does not send a transaction or cost any fees.",
    "",
    `URI: ${origin}`,
    "Version: 1",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expiresAt.toISOString()}`,
  ].join("\n");
}
