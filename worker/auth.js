/**
 * Cloudflare Access Zero Trust JWT Verification & Role Authorization Middleware
 *
 * PRODUCTION ARCHITECTURE:
 * 1. Cloudflare Access protects `/admin` and `/api/admin/*` at the Cloudflare Edge.
 * 2. Incoming requests carry a cryptographically signed header: `Cf-Access-Jwt-Assertion` (or `CF_Authorization`).
 * 3. This middleware imports Cloudflare's public JWK certificates and verifies:
 *    - Cryptographic RS256 signature
 *    - Token expiration (exp)
 *    - Cloudflare Access Application Audience Tag (aud)
 *    - User Email Allowlist (if ALLOWED_ADMIN_EMAILS is configured)
 * 4. In local development (`ENVIRONMENT = 'development'`), it provides a seamless local developer
 *    session while maintaining full server-side guard separation.
 */

// In-memory cache for Cloudflare Access public JWKs to minimize external network requests
let cachedKeys = null;
let keysExpiry = 0;

/**
 * Base64URL decoder for standard Web Crypto operations
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parse JWT segments into header, payload, and signature
 */
function parseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
    return { header, payload, rawSignature: parts[2], signedData: `${parts[0]}.${parts[1]}` };
  } catch (e) {
    return null;
  }
}

/**
 * Fetch and cache Cloudflare Access public JWKs (cached for 1 hour)
 */
async function getAccessPublicKeys(teamDomain) {
  const now = Date.now();
  if (cachedKeys && now < keysExpiry) {
    return cachedKeys;
  }

  try {
    const url = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch Cloudflare certs: ${res.statusText}`);
    const data = await res.json();
    cachedKeys = data.keys || [];
    keysExpiry = now + 1000 * 60 * 60; // 1 hour TTL
    return cachedKeys;
  } catch (err) {
    console.error('Error fetching Cloudflare Access public keys:', err);
    return [];
  }
}

/**
 * Cryptographically verify Cloudflare Access JWT using Web Crypto API (SubtleCrypto)
 */
async function verifyJwt(jwtToken, env) {
  const parsed = parseJwt(jwtToken);
  if (!parsed) return { valid: false, reason: 'Malformed JWT assertion' };

  const { header, payload, rawSignature, signedData } = parsed;

  // 1. Verify Expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return { valid: false, reason: 'Token has expired' };
  }

  // 2. Verify Audience (AUD) against configured Cloudflare Access Application
  if (env.CF_ACCESS_AUD && payload.aud !== env.CF_ACCESS_AUD) {
    return { valid: false, reason: 'Audience mismatch' };
  }

  // 3. Cryptographic Signature Verification against Cloudflare Team JWK
  if (env.CF_ACCESS_TEAM_DOMAIN) {
    const keys = await getAccessPublicKeys(env.CF_ACCESS_TEAM_DOMAIN);
    const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) return { valid: false, reason: `Matching public key (${header.kid}) not found` };

    try {
      const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
        false,
        ['verify']
      );

      const signatureBytes = base64UrlDecode(rawSignature);
      const dataBytes = new TextEncoder().encode(signedData);

      const isValid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        signatureBytes,
        dataBytes
      );

      if (!isValid) return { valid: false, reason: 'Cryptographic signature verification failed' };
    } catch (err) {
      console.error('Crypto subtle verification error:', err);
      return { valid: false, reason: 'Verification error' };
    }
  }

  // 4. Optional Email Allowlist Verification
  const userEmail = (payload.email || payload.sub || '').toLowerCase();
  if (env.ALLOWED_ADMIN_EMAILS) {
    const allowed = env.ALLOWED_ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!allowed.includes(userEmail)) {
      return { valid: false, reason: `Email ${userEmail} is not authorized for admin access`, isForbidden: true };
    }
  }

  return { valid: true, email: userEmail };
}

/**
 * Server-Side Authentication Guard
 */
export async function requireAdminAuth(request, env) {
  // 1. Extract Assertion Token
  const token = request.headers.get('Cf-Access-Jwt-Assertion') ||
    request.headers.get('CF_Authorization') ||
    getCookie(request, 'CF_Authorization');

  const userEmailHeader = request.headers.get('Cf-Access-Authenticated-User-Email');

  // 2. Production Security Enforcement
  const isProduction = env.ENVIRONMENT === 'production' || !!env.CF_ACCESS_AUD || !!env.CF_ACCESS_TEAM_DOMAIN;

  if (isProduction) {
    if (!token) {
      return {
        authenticated: false,
        response: new Response(
          JSON.stringify({ error: 'Unauthorized: Cloudflare Access Zero Trust token required' }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'WWW-Authenticate': 'Bearer error="invalid_token", error_description="Missing Cloudflare Access assertion"'
            }
          }
        )
      };
    }

    const verification = await verifyJwt(token, env);
    if (!verification.valid) {
      const statusCode = verification.isForbidden ? 403 : 401;
      return {
        authenticated: false,
        response: new Response(
          JSON.stringify({ error: `Access Denied: ${verification.reason}` }),
          { status: statusCode, headers: { 'Content-Type': 'application/json' } }
        )
      };
    }

    return {
      authenticated: true,
      email: verification.email || userEmailHeader || 'admin@chitwanwoodcraft.com.np',
      isDev: false
    };
  }

  // 3. Local Development Mode Simulation
  return {
    authenticated: true,
    email: userEmailHeader || 'dev-admin@chitwanwoodcraft.com.np',
    isDev: true
  };
}

/**
 * Helper to extract a cookie from Request headers
 */
function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}
