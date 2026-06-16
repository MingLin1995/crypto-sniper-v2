import { NextRequest, NextResponse } from "next/server";

// Clean any trailing /v1 prefix from the environment variable
const API_URL = (process.env.API_URL || "http://app:3000/api").replace(/\/v1$/, "");

// Global promise to deduplicate concurrent refresh token requests
let activeRefreshPromise: Promise<{ setCookies: string[] } | null> | null = null;

async function handleProxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  const path = params.path.join("/");
  const searchParams = req.nextUrl.search;
  const targetUrl = `${API_URL}/${path}${searchParams}`;

  const method = req.method;
  const headers = new Headers();

  // 1. CSRF Protection for state-mutating requests
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const host = req.headers.get("host"); // e.g. localhost:3001

    if (origin) {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return NextResponse.json({ message: "CSRF check failed: Invalid origin" }, { status: 403 });
      }
    } else if (referer) {
      const refererUrl = new URL(referer);
      if (refererUrl.host !== host) {
        return NextResponse.json({ message: "CSRF check failed: Invalid referer" }, { status: 403 });
      }
    } else {
      // Reject if both origin and referer are missing for state-mutating requests
      return NextResponse.json({ message: "CSRF check failed: Missing origin and referer" }, { status: 403 });
    }
  }

  // 2. Clone request headers (except host)
  req.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "host") {
      headers.set(key, value);
    }
  });

  // 3. Read body if mutating request
  let body: ArrayBuffer | null = null;
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = await req.arrayBuffer();
    } catch {
      body = null;
    }
  }

  try {
    // 4. Send request to NestJS
    let response = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: "manual",
    });

    // 5. Automatic Refresh Token logic if 401 Unauthorized
    const cookieHeader = req.headers.get("cookie") || "";
    const hasRefreshToken = cookieHeader.includes("refresh_token=");

    if (response.status === 401 && hasRefreshToken) {
      console.log(`[BFF Proxy] Access token expired for ${path}. Attempting to refresh tokens...`);
      
      // Use shared promise to deduplicate parallel refresh requests
      if (!activeRefreshPromise) {
        activeRefreshPromise = (async () => {
          try {
            console.log(`[BFF Proxy] Shared token refresh triggered by request to ${path}`);
            const refreshHeaders = new Headers();
            refreshHeaders.set("cookie", cookieHeader);
            const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
              method: "POST",
              headers: refreshHeaders,
            });
            if (refreshRes.ok) {
              const setCookies = refreshRes.headers.getSetCookie();
              return { setCookies };
            }
          } catch (e) {
            console.error("[BFF Proxy] Shared token refresh error:", e);
          }
          return null;
        })();
        
        activeRefreshPromise.finally(() => {
          activeRefreshPromise = null;
        });
      }

      const refreshResult = await activeRefreshPromise;

      if (refreshResult) {
        console.log("[BFF Proxy] Refresh token succeeded. Retrying original request...");
        
        // Extract new cookies from the NestJS refresh response
        const newSetCookies = refreshResult.setCookies;
        
        // Rebuild headers for the retried original request
        const retryHeaders = new Headers();
        req.headers.forEach((value, key) => {
          if (key.toLowerCase() !== "host") {
            retryHeaders.set(key, value);
          }
        });

        // Set the new cookies so the retried request has the active access token
        if (newSetCookies.length > 0) {
          // Combine new cookies with existing ones in the headers
          const parsedCookies = newSetCookies.map(cookieStr => cookieStr.split(";")[0]);
          let combinedCookie = cookieHeader;
          parsedCookies.forEach(cookie => {
            const name = cookie.split("=")[0].trim();
            // Rebuild cookie string by removing existing occurrences of the cookie key to prevent ReDoS
            const cookieParts = combinedCookie.split("; ").filter(Boolean);
            const filteredParts = cookieParts.filter(part => !part.startsWith(`${name}=`));
            filteredParts.push(cookie);
            combinedCookie = filteredParts.join("; ");
          });
          retryHeaders.set("cookie", combinedCookie);
        }

        // Retry the original request
        response = await fetch(targetUrl, {
          method,
          headers: retryHeaders,
          body,
          redirect: "manual",
        });

        // Create new response and forward the Set-Cookie headers from the refresh call
        const finalHeaders = new Headers();
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() !== "set-cookie") {
            finalHeaders.set(key, value);
          }
        });

        // Add both the new session cookies and any final headers
        newSetCookies.forEach(cookieVal => {
          finalHeaders.append("set-cookie", cookieVal);
        });
        
        // Also forward any new set-cookie headers from the retried response
        response.headers.getSetCookie().forEach(cookieVal => {
          finalHeaders.append("set-cookie", cookieVal);
        });

        const data = await response.arrayBuffer();
        return new NextResponse(data, {
          status: response.status,
          statusText: response.statusText,
          headers: finalHeaders,
        });
      } else {
        console.warn("[BFF Proxy] Refresh token failed. Logging out user...");
        // If refresh fails, clear cookies so the user is logged out
        const clearHeaders = new Headers();
        clearHeaders.append(
          "set-cookie",
          "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly; secure; samesite=lax"
        );
        clearHeaders.append(
          "set-cookie",
          "refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly; secure; samesite=lax"
        );

        return new NextResponse(
          JSON.stringify({ message: "Session expired. Please log in again." }),
          {
            status: 401,
            headers: clearHeaders,
          }
        );
      }
    }

    // 6. Forward headers and body normally
    const finalHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        finalHeaders.append(key, value);
      } else {
        finalHeaders.set(key, value);
      }
    });

    const data = await response.arrayBuffer();
    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: finalHeaders,
    });
  } catch (error) {
    console.error(`[BFF Proxy] Error proxying request to ${path}:`, error);
    return NextResponse.json({ message: "Internal server proxy error" }, { status: 500 });
  }
}

export {
  handleProxy as GET,
  handleProxy as POST,
  handleProxy as PUT,
  handleProxy as PATCH,
  handleProxy as DELETE,
};
