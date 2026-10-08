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
 * In production set NEXT_PUBLIC_SITE_URL so the domain is fixed and
 * cannot be influenced by request headers.
 */
export function getSiteInfo(req: Request): SiteInfo | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    try {
      const url = new URL(configured);
      return { domain: url.host, origin: url.origin };
    } catch {
      return null;
    }
  }

  const host = (
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    ""
  ).trim();

  if (!host) return null;

  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (isLocal ? "http" : "https");

  return { domain: host, origin: `${proto}://${host}` };
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