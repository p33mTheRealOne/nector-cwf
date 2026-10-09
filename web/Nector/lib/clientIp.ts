// lib/clientIp.ts
// Client IP for rate limiting.
//
// Only headers that the hosting platform sets itself are trusted first.
// On Vercel, x-vercel-forwarded-for / x-real-ip are written by the edge and
// cannot be supplied by the client. x-forwarded-for is the last fallback.
// If you deploy behind another proxy, make sure it overwrites these headers.

import { createHmac } from "crypto";

export function getClientIp(req: Request): string | null {
  const h = req.headers;

  const direct =
    h.get("x-vercel-forwarded-for")?.trim() || h.get("x-real-ip")?.trim();
  if (direct) return direct.split(",")[0].trim();

  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || null;
}

/** Store a keyed hash instead of the raw IP address. */
export function hashIp(ip: string): string {
  const key =
    process.env.AUTH_IP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createHmac("sha256", key).update(ip).digest("hex");
}
