const VERSION = "VICTOR_EDGE_PROXY_V1";
const MAX_TELEGRAM_BODY_BYTES = 1024 * 1024;
const WINDOW_SECONDS = 60;

const HEALTH_PATHS = new Set([
  "/health",
  "/v2-health",
  "/endgame-runtime-health",
  "/core-health",
  "/telegram-webhook-health",
  "/telegram-webhook-health/",
  "/aura3-bridge-health",
  "/aura3-bridge-health/",
  "/aura3-health",
  "/aura3-health/",
  "/tony-bridge-health",
  "/tony-bridge-health/",
  "/tony-health",
  "/tony-health/"
]);

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...extraHeaders
    }
  });
}

function routePolicy(method, pathname) {
  if (method === "GET" && pathname === "/proxy-health") return "PROXY_HEALTH";
  if (method === "GET" && HEALTH_PATHS.has(pathname)) return "UPSTREAM_HEALTH";
  if (method === "POST" && pathname === "/telegram") return "TELEGRAM";
  return "DENY";
}

async function shortHash(value) {
  const bytes = new TextEncoder().encode(String(value || "unknown"));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function rateLimit(env, request, kind) {
  if (!env.EDGE_STATE) return { ok: false, reason: "RATE_STORE_UNAVAILABLE" };
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipHash = await shortHash(ip);
  const limit = kind === "TELEGRAM" ? 90 : 180;
  const bucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
  const key = `victor-edge-rate:v1:${kind}:${bucket}:${ipHash}`;
  try {
    const current = Number(await env.EDGE_STATE.get(key) || "0");
    if (current >= limit) return { ok: false, reason: "RATE_LIMITED", limit };
    await env.EDGE_STATE.put(key, String(current + 1), { expirationTtl: WINDOW_SECONDS * 2 });
    return { ok: true, limit, remainingApprox: Math.max(0, limit - current - 1) };
  } catch {
    return { ok: false, reason: "RATE_STORE_ERROR" };
  }
}

function sanitizedHeaders(request, requestId) {
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith("x-victor-edge-")) headers.delete(name);
  }
  headers.set("x-victor-edge-proxy", VERSION);
  headers.set("x-victor-edge-request-id", requestId);
  headers.set("x-forwarded-proto", "https");
  headers.set("x-forwarded-host", new URL(request.url).host);
  return headers;
}

function edgeResponse(response, requestId) {
  const headers = new Headers(response.headers);
  headers.set("x-victor-edge-proxy", VERSION);
  headers.set("x-victor-edge-request-id", requestId);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function upstreamFetch(env, request, requestId, bodyOverride) {
  if (!env.VICTOR_UPSTREAM || typeof env.VICTOR_UPSTREAM.fetch !== "function") {
    return json({ service: "victor-edge-proxy", status: "SAFE_STOP", error: "UPSTREAM_BINDING_UNAVAILABLE", secrets_exposed: false }, 503, {
      "x-victor-edge-proxy": VERSION,
      "x-victor-edge-request-id": requestId
    });
  }
  const headers = sanitizedHeaders(request, requestId);
  const init = { method: request.method, headers, redirect: "manual" };
  if (bodyOverride !== undefined) init.body = bodyOverride;
  const forwarded = new Request(request.url, init);
  try {
    const response = await env.VICTOR_UPSTREAM.fetch(forwarded);
    return edgeResponse(response, requestId);
  } catch {
    return json({ service: "victor-edge-proxy", status: "SAFE_STOP", error: "UPSTREAM_UNAVAILABLE", secrets_exposed: false }, 503, {
      "x-victor-edge-proxy": VERSION,
      "x-victor-edge-request-id": requestId
    });
  }
}

export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const policy = routePolicy(request.method, url.pathname);

    if (policy === "DENY") {
      return json({ service: "victor-edge-proxy", status: "DENIED", error: "ROUTE_NOT_ALLOWED", secrets_exposed: false }, 404, {
        "x-victor-edge-proxy": VERSION,
        "x-victor-edge-request-id": requestId
      });
    }

    if (policy === "PROXY_HEALTH") {
      const limit = await rateLimit(env, request, "HEALTH");
      if (!limit.ok && limit.reason === "RATE_LIMITED") {
        return json({ service: "victor-edge-proxy", status: "RATE_LIMITED", secrets_exposed: false }, 429, {
          "x-victor-edge-proxy": VERSION,
          "x-victor-edge-request-id": requestId
        });
      }
      const healthUrl = new URL(request.url);
      healthUrl.pathname = "/health";
      healthUrl.search = "";
      const probe = new Request(healthUrl.toString(), { method: "GET", headers: sanitizedHeaders(request, requestId) });
      if (!env.VICTOR_UPSTREAM || typeof env.VICTOR_UPSTREAM.fetch !== "function") {
        return json({ service: "victor-edge-proxy", version: VERSION, status: "SAFE_STOP", upstream: "UNBOUND", secrets_exposed: false }, 503, {
          "x-victor-edge-proxy": VERSION,
          "x-victor-edge-request-id": requestId
        });
      }
      try {
        const response = await env.VICTOR_UPSTREAM.fetch(probe);
        return json({
          service: "victor-edge-proxy",
          version: VERSION,
          status: response.ok ? "READY" : "SAFE_STOP",
          upstream_http_status: response.status,
          upstream_transport: "CLOUDFLARE_SERVICE_BINDING",
          tls_edge: "CLOUDFLARE_MANAGED",
          auth_boundary: "PRIMARY_VICTOR_WORKER",
          rate_limit_store: env.EDGE_STATE ? "KV_BOUND_APPROXIMATE" : "UNAVAILABLE",
          production_autonomy_changed: false,
          secrets_exposed: false
        }, response.ok ? 200 : 503, {
          "x-victor-edge-proxy": VERSION,
          "x-victor-edge-request-id": requestId
        });
      } catch {
        return json({ service: "victor-edge-proxy", version: VERSION, status: "SAFE_STOP", upstream: "UNAVAILABLE", secrets_exposed: false }, 503, {
          "x-victor-edge-proxy": VERSION,
          "x-victor-edge-request-id": requestId
        });
      }
    }

    const limit = await rateLimit(env, request, policy === "TELEGRAM" ? "TELEGRAM" : "HEALTH");
    if (!limit.ok) {
      const status = limit.reason === "RATE_LIMITED" ? 429 : policy === "TELEGRAM" ? 503 : 200;
      if (status !== 200) {
        return json({ service: "victor-edge-proxy", status: "SAFE_STOP", error: limit.reason, secrets_exposed: false }, status, {
          "x-victor-edge-proxy": VERSION,
          "x-victor-edge-request-id": requestId
        });
      }
    }

    if (policy === "TELEGRAM") {
      const suppliedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
      if (!suppliedSecret) {
        return json({ service: "victor-edge-proxy", status: "DENIED", error: "WEBHOOK_SECRET_HEADER_REQUIRED", secrets_exposed: false }, 401, {
          "x-victor-edge-proxy": VERSION,
          "x-victor-edge-request-id": requestId
        });
      }
      const contentType = (request.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("application/json")) {
        return json({ service: "victor-edge-proxy", status: "DENIED", error: "JSON_REQUIRED", secrets_exposed: false }, 415, {
          "x-victor-edge-proxy": VERSION,
          "x-victor-edge-request-id": requestId
        });
      }
      const declaredLength = Number(request.headers.get("content-length") || "0");
      if (declaredLength > MAX_TELEGRAM_BODY_BYTES) {
        return json({ service: "victor-edge-proxy", status: "DENIED", error: "PAYLOAD_TOO_LARGE", secrets_exposed: false }, 413, {
          "x-victor-edge-proxy": VERSION,
          "x-victor-edge-request-id": requestId
        });
      }
      const body = await request.arrayBuffer();
      if (body.byteLength > MAX_TELEGRAM_BODY_BYTES) {
        return json({ service: "victor-edge-proxy", status: "DENIED", error: "PAYLOAD_TOO_LARGE", secrets_exposed: false }, 413, {
          "x-victor-edge-proxy": VERSION,
          "x-victor-edge-request-id": requestId
        });
      }
      return upstreamFetch(env, request, requestId, body);
    }

    return upstreamFetch(env, request, requestId);
  }
};

export { HEALTH_PATHS, MAX_TELEGRAM_BODY_BYTES, VERSION, routePolicy };
