import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns";

// On some Windows/VPN/router setups, Node's fetch tries a host's IPv6
// address first (Happy Eyeballs) and IPv6 routing is broken or extremely
// slow even though IPv4 works fine — the request just stalls until our
// timeout fires, even though the host itself is up and reachable. Forcing
// IPv4-first resolution is a well-known fix for exactly this symptom.
dns.setDefaultResultOrder("ipv4first");

// Proxies a remote URL (NFT off-chain metadata JSON or image) through the
// server so the browser never has to fetch it directly. Browser `fetch()`
// calls to Arweave/Irys/CDN gateways often get blocked by CORS because
// those hosts don't send an `Access-Control-Allow-Origin` header — but a
// server-to-server request has no such restriction, so we fetch here and
// stream the bytes back to the client.
//
// devnet Irys nodes are also known to be slow/flaky (occasional upstream
// timeouts show up as Cloudflare's 524 "A Timeout Occurred"), so this
// retries a few times with a short backoff and a per-attempt timeout
// instead of hanging on one slow request.
//
// Usage: /api/nft-image?url=<encoded remote url>

const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 800;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOnce(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      // Some CDNs / bot-protection layers reject requests that don't look
      // like they came from a browser (missing UA/Accept headers).
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept: "*/*",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");

  if (!target) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  const urlStr = parsed.toString();

  let upstream: Response | null = null;
  let lastErr: any = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      upstream = await fetchOnce(urlStr);
      if (upstream.ok) break;

      lastErr = `Upstream responded with ${upstream.status} ${upstream.statusText}`.trim();
      console.error(`[/api/nft-image] attempt ${attempt} not ok for`, urlStr, lastErr);
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      lastErr = isTimeout
        ? `Timed out after ${TIMEOUT_MS / 1000}s waiting for the image host`
        : err?.message || String(err);
      console.error(`[/api/nft-image] attempt ${attempt} threw for`, urlStr, lastErr);
      upstream = null;
    }

    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }

  if (!upstream || !upstream.ok) {
    return NextResponse.json(
      { error: `${lastErr || "Unknown error"} (after ${MAX_ATTEMPTS} attempts)` },
      { status: 502 }
    );
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const buf = await upstream.arrayBuffer();

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
    },
  });
}