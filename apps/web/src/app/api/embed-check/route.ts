import { NextRequest, NextResponse } from "next/server";

// Checks whether an external URL allows being embedded in an iframe.
// Cross-origin frames are opaque to client JS, so the browser's
// "refused to connect" error can't be detected there — we inspect the
// response headers (X-Frame-Options / CSP frame-ancestors) server-side.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ embeddable: false, reason: "invalid-url" });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
      // Some servers reject HEAD — retry with GET before concluding anything.
      if (res.status >= 400) {
        res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
      }
    } finally {
      clearTimeout(timer);
    }

    const xfo = (res.headers.get("x-frame-options") || "").toLowerCase();
    if (xfo.includes("deny") || xfo.includes("sameorigin")) {
      return NextResponse.json({ embeddable: false, reason: "x-frame-options" });
    }
    const csp = (res.headers.get("content-security-policy") || "").toLowerCase();
    const m = csp.match(/frame-ancestors\s+([^;]+)/);
    if (m && !m[1].includes("*")) {
      return NextResponse.json({ embeddable: false, reason: "csp-frame-ancestors" });
    }
    return NextResponse.json({ embeddable: true });
  } catch {
    // Network failure / timeout — let the iframe try anyway rather than block a working URL.
    return NextResponse.json({ embeddable: true, reason: "unreachable" });
  }
}
