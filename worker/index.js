/**
 * Chitwan Wood Craft — Cloudflare Worker API & Static Asset Server
 * Routes public APIs, enforces Cloudflare Access Zero Trust on Admin routes & APIs, and serves static frontend assets.
 */

import { requireAdminAuth } from './auth.js';
import {
  handleGetCategories,
  handleGetProducts,
  handleGetProductById,
  handleGetMedia
} from './api/public.js';
import { handleContactSubmission } from './api/contact.js';
import {
  handleAdminGetProducts,
  handleAdminGetProductById,
  handleAdminCreateProduct,
  handleAdminUpdateProduct,
  handleAdminDeleteProduct,
  handleAdminUploadImage,
  handleAdminDeleteImage
} from './api/admin.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // 1. CORS Preflight Handling
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cf-Access-Jwt-Assertion, X-Product-Id, X-File-Name, X-Dev-Admin',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // 2. Public API Routes (Read-only, high performance)
    if (pathname === '/api/categories' && method === 'GET') {
      return handleGetCategories(request, env);
    }

    if (pathname === '/api/products' && method === 'GET') {
      return handleGetProducts(request, env);
    }

    if (pathname.startsWith('/api/products/') && method === 'GET') {
      const id = pathname.substring('/api/products/'.length);
      if (id) return handleGetProductById(request, env, id);
    }

    if (pathname.startsWith('/api/media/')) {
      const key = pathname.substring('/api/media/'.length);
      if (key) return handleGetMedia(request, env, key);
    }

    // Hero Background Video Streaming Route
    if (pathname === '/img/hero-video.mp4' || pathname === '/img/hero-video.mp4.mp4') {
      // 1. In Production or when present in R2: stream directly from R2 bucket
      if (env.BUCKET) {
        try {
          const object = await env.BUCKET.get('hero-video.mp4');
          if (object) {
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('Content-Type', 'video/mp4');
            headers.set('Accept-Ranges', 'bytes');
            headers.set('Cache-Control', 'public, max-age=31536000, immutable');
            return new Response(object.body, { headers });
          }
        } catch (r2Err) {
          console.error('[R2 Hero Video Error]', r2Err);
        }
      }

      // 2. In Local Development: stream from local server with Range support
      if (env.ENVIRONMENT === 'development') {
        try {
          const forwardHeaders = new Headers();
          const range = request.headers.get('range');
          if (range) forwardHeaders.set('Range', range);
          const devRes = await fetch('http://127.0.0.1:8000/img/hero-video.mp4', {
            headers: forwardHeaders
          });
          if (devRes.ok || devRes.status === 206) {
            const resHeaders = new Headers(devRes.headers);
            resHeaders.set('Content-Type', 'video/mp4');
            resHeaders.set('Accept-Ranges', 'bytes');
            return new Response(devRes.body, {
              status: devRes.status,
              headers: resHeaders
            });
          }
        } catch (proxyErr) {
          console.error('[Video Proxy Dev Error]', proxyErr);
        }
      }

      return new Response('Hero video not found', { status: 404 });
    }

    // Contact Form & Inquiry Submission API
    if (pathname === '/api/contact' && method === 'POST') {
      return handleContactSubmission(request, env);
    }

    // 3. Admin API Routes (Strictly protected by Cloudflare Access)
    if (pathname.startsWith('/api/admin/')) {
      const auth = await requireAdminAuth(request, env);
      if (!auth.authenticated) {
        return auth.response;
      }

      // GET /api/admin/products
      if (pathname === '/api/admin/products' && method === 'GET') {
        return handleAdminGetProducts(request, env);
      }

      // POST /api/admin/products
      if (pathname === '/api/admin/products' && method === 'POST') {
        return handleAdminCreateProduct(request, env);
      }

      // GET /api/admin/products/:id
      if (pathname.startsWith('/api/admin/products/') && method === 'GET') {
        const id = pathname.substring('/api/admin/products/'.length);
        return handleAdminGetProductById(request, env, id);
      }

      // PUT /api/admin/products/:id
      if (pathname.startsWith('/api/admin/products/') && method === 'PUT') {
        const id = pathname.substring('/api/admin/products/'.length);
        return handleAdminUpdateProduct(request, env, id);
      }

      // DELETE /api/admin/products/:id
      if (pathname.startsWith('/api/admin/products/') && method === 'DELETE') {
        const id = pathname.substring('/api/admin/products/'.length);
        return handleAdminDeleteProduct(request, env, id);
      }

      // POST /api/admin/upload
      if (pathname === '/api/admin/upload' && method === 'POST') {
        return handleAdminUploadImage(request, env);
      }

      // DELETE /api/admin/images/:id
      if (pathname.startsWith('/api/admin/images/') && method === 'DELETE') {
        const imageId = pathname.substring('/api/admin/images/'.length);
        return handleAdminDeleteImage(request, env, imageId);
      }

      // GET /api/admin/me (Return authenticated user info)
      if (pathname === '/api/admin/me' && method === 'GET') {
        return new Response(JSON.stringify({
          authenticated: true,
          email: auth.email,
          isDev: !!auth.isDev
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
          }
        });
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Admin HTML / Assets Route Guard & Rewrite
    // Even if an unauthorized visitor tries to load /admin/ directly, the Worker blocks it
    if (pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin/')) {
      const auth = await requireAdminAuth(request, env);
      if (!auth.authenticated) {
        return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>401 Unauthorized — Chitwan Wood Craft</title>
  <meta name="robots" content="noindex, nofollow, noarchive">
  <style>
    body { font-family: system-ui, sans-serif; background: #1b110b; color: #faf5ec; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; text-align: center; }
    .card { background: #3a2416; padding: 40px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); max-width: 460px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
    h1 { color: #e0a95d; margin: 0 0 16px; font-size: 24px; }
    p { color: rgba(250,245,236,0.8); line-height: 1.6; margin-bottom: 24px; font-size: 15px; }
    a { display: inline-block; background: #c8863c; color: #1b110b; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Access Restricted</h1>
    <p>This administrative area is protected by Cloudflare Zero Trust. Authentication via an authorized organization identity is required.</p>
    <a href="/">← Return to Public Website</a>
  </div>
</body>
</html>`, {
          status: 401,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Robots-Tag': 'noindex, nofollow, noarchive'
          }
        });
      }

      const adminUrl = new URL(pathname === '/admin' || pathname === '/admin/' ? '/admin/index.html' : pathname, request.url);
      if (env.ASSETS) {
        const res = await env.ASSETS.fetch(new Request(adminUrl, request));
        const headers = new Headers(res.headers);
        headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        return new Response(res.body, { status: res.status, headers });
      }
    }

    // 5. Static Assets Delivery (Cloudflare Worker Static Assets)
    if (env.ASSETS) {
      const res = await env.ASSETS.fetch(request);
      if (res.status === 404 && !pathname.includes('.')) {
        // SPA fallback to index.html if route not found
        return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
      }
      return res;
    }

    return new Response('Not Found', { status: 404 });
  }
};
