/**
 * Chitwan Wood Craft — Contact Form & Inquiry Email Delivery API
 *
 * PRODUCTION-READY ARCHITECTURE & SECURITY:
 * 1. Safe JSON parsing with 64KB payload size limits & Content-Type enforcement.
 * 2. Cloudflare-native Rate Limiting binding (env.CONTACT_RATE_LIMITER) supporting 5 requests/60s per IP (with dev fallback).
 * 3. Strict same-origin headers (No wildcard CORS).
 * 4. Comprehensive input validation: Name, Email, Phone, What They Need, and Details.
 * 5. Anti-spam honeypot field detection.
 * 6. HTML output sanitization to prevent email injection attacks.
 * 7. Cloudflare CF-Connecting-IP identification (no spoofable headers).
 * 8. Zero customer IP leakage in emails sent to staff.
 * 9. Explicit environment guard (env.ENVIRONMENT === 'development') — HTTP 503 in production if RESEND_API_KEY is missing.
 * 10. Reply-To set to customer's validated email address.
 */

// Local development in-memory rate limiter fallback (Active ONLY in dev mode)
// Enforces a dev limit of 10 requests per 10 minutes for local testing.
const devRateLimitMap = new Map();
const DEV_RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const DEV_MAX_REQUESTS = 10;

/**
 * HTML Sanitization Helper to prevent HTML injection in emails
 */
function sanitizeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strict Email format validator
 */
function isValidEmail(email) {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(String(email).toLowerCase());
}

/**
 * Phone validator allowing standard phone characters: digits, +, spaces, hyphens, parentheses
 */
function isValidPhone(phone) {
  const phonePattern = /^[0-9+\s\-()./]{7,35}$/;
  if (!phonePattern.test(phone)) return false;
  // Must contain at least 7 actual numeric digits
  const digitCount = (phone.match(/\d/g) || []).length;
  return digitCount >= 7 && digitCount <= 20;
}

/**
 * POST /api/contact handler
 */
export async function handleContactSubmission(request, env) {
  // Same-origin JSON response headers (No wildcard CORS)
  const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate'
  };

  try {
    const isDev = env.ENVIRONMENT === 'development';

    // 1. Authoritative Client IP (Use CF-Connecting-IP on Cloudflare)
    const clientIp = request.headers.get('CF-Connecting-IP') || (isDev ? '127.0.0.1' : 'unknown');

    // 2. Production Cloudflare Rate Limiter Binding or Dev Fallback
    if (env.CONTACT_RATE_LIMITER && typeof env.CONTACT_RATE_LIMITER.limit === 'function') {
      try {
        const { success } = await env.CONTACT_RATE_LIMITER.limit({ key: clientIp });
        if (!success) {
          return new Response(JSON.stringify({
            error: 'Too many enquiries sent from your connection. Please wait a few minutes or call us directly.'
          }), {
            status: 429,
            headers: JSON_HEADERS
          });
        }
      } catch (rlErr) {
        console.error('[RateLimiter Error]', rlErr);
      }
    } else if (isDev) {
      // Local dev rate limiter
      const now = Date.now();
      const rateData = devRateLimitMap.get(clientIp) || { count: 0, resetTime: now + DEV_RATE_LIMIT_WINDOW };
      if (now > rateData.resetTime) {
        rateData.count = 1;
        rateData.resetTime = now + DEV_RATE_LIMIT_WINDOW;
      } else {
        rateData.count++;
      }
      devRateLimitMap.set(clientIp, rateData);

      if (rateData.count > DEV_MAX_REQUESTS) {
        return new Response(JSON.stringify({
          error: 'Too many enquiries sent in development mode. Please wait a few minutes.'
        }), {
          status: 429,
          headers: JSON_HEADERS
        });
      }
    }

    // 3. Request Safety & Media Type Checks
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return new Response(JSON.stringify({
        error: 'Unsupported content type. Requests must be application/json.'
      }), {
        status: 415,
        headers: JSON_HEADERS
      });
    }

    // Check payload size limit (Max 64 KB)
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > 65536) {
      return new Response(JSON.stringify({
        error: 'Payload too large. Maximum size is 64KB.'
      }), {
        status: 413,
        headers: JSON_HEADERS
      });
    }

    // Read and parse JSON safely
    const rawBody = await request.text();
    if (rawBody.length > 65536) {
      return new Response(JSON.stringify({
        error: 'Payload body exceeds 64KB limit.'
      }), {
        status: 413,
        headers: JSON_HEADERS
      });
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      return new Response(JSON.stringify({
        error: 'Malformed JSON payload.'
      }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Response(JSON.stringify({
        error: 'Invalid request body format.'
      }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    // 4. Honeypot check (Silent drop if bots populate the hidden field)
    if (body._gotcha) {
      console.warn(`[Anti-Spam] Honeypot triggered from IP: ${clientIp}`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Your enquiry has been received.'
      }), {
        status: 200,
        headers: JSON_HEADERS
      });
    }

    // 5. Strict Input Validation
    const rawName = body.name;
    const rawPhone = body.phone;
    const rawEmail = body.email;
    const rawSubject = body.whatDoYouNeed || body.subject;
    const rawDetails = body.details || body.message;

    // Validate Name (2 to 100 chars)
    if (!rawName || typeof rawName !== 'string' || rawName.trim().length < 2 || rawName.trim().length > 100) {
      return new Response(JSON.stringify({
        error: 'Please enter a valid full name (between 2 and 100 characters).'
      }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    // Validate Email (Valid format, max 150 chars)
    if (!rawEmail || typeof rawEmail !== 'string' || rawEmail.trim().length > 150 || !isValidEmail(rawEmail.trim())) {
      return new Response(JSON.stringify({
        error: 'Please enter a valid email address (e.g. name@example.com).'
      }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    // Validate Phone (Sensible length, allowed chars, >=7 digits)
    if (!rawPhone || typeof rawPhone !== 'string' || !isValidPhone(rawPhone.trim())) {
      return new Response(JSON.stringify({
        error: 'Please enter a valid phone or mobile number (at least 7 digits).'
      }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    // Validate What They Need / Subject (REQUIRED, 2 to 200 chars)
    if (!rawSubject || typeof rawSubject !== 'string' || rawSubject.trim().length < 2 || rawSubject.trim().length > 200) {
      return new Response(JSON.stringify({
        error: 'Please specify what product or woodwork you need (between 2 and 200 characters).'
      }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    // Validate Details / Message (REQUIRED, 5 to 3000 chars)
    if (!rawDetails || typeof rawDetails !== 'string' || rawDetails.trim().length < 5 || rawDetails.trim().length > 3000) {
      return new Response(JSON.stringify({
        error: 'Please provide enquiry details or dimensions (between 5 and 3000 characters).'
      }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    const cleanName = rawName.trim();
    const cleanEmail = rawEmail.trim().toLowerCase();
    const cleanPhone = rawPhone.trim();
    const cleanSubject = rawSubject.trim();
    const cleanDetails = rawDetails.trim();

    // 6. Centralized Email Configuration
    const TO_EMAIL = env.CONTACT_EMAIL || 'info@chitwanwoodcraft.com.np';
    const FROM_EMAIL = env.FROM_EMAIL || (isDev ? 'Chitwan Wood Craft <onboarding@resend.dev>' : 'Chitwan Wood Craft <enquiries@chitwanwoodcraft.com.np>');
    const emailSubject = `New Website Enquiry — ${cleanName}`;
    const submissionTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' }) + ' (NPT)';

    // Plaintext Template (Privacy respected: NO visitor IP leaked in email)
    const textContent = `
New enquiry received from the Chitwan Wood Craft website.

=======================================================
Name:            ${cleanName}
Phone:           ${cleanPhone}
Email:           ${cleanEmail}
What they need:  ${cleanSubject}
Details:         ${cleanDetails}

Submitted:       ${submissionTime}
=======================================================
`;

    // HTML Template (Privacy respected: NO visitor IP leaked in email)
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f3eb; margin: 0; padding: 24px; color: #3a2416; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5dac9; box-shadow: 0 4px 16px rgba(58,36,22,0.06); }
    .header { background: #3a2416; color: #faf5ec; padding: 28px 32px; }
    .header h2 { margin: 0 0 6px; font-size: 22px; color: #e0a95d; }
    .header p { margin: 0; font-size: 13.5px; opacity: 0.85; }
    .body { padding: 32px; }
    .field-row { margin-bottom: 20px; border-bottom: 1px solid #f0e6d6; padding-bottom: 14px; }
    .field-row:last-child { border-bottom: none; margin-bottom: 0; }
    .label { font-size: 11.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #7c6a5a; margin-bottom: 4px; }
    .value { font-size: 15.5px; color: #1b110b; line-height: 1.5; font-weight: 500; }
    .details-box { background: #faf5ec; border-radius: 8px; padding: 16px; border: 1px solid #e8dcce; font-family: inherit; font-size: 14.5px; line-height: 1.6; white-space: pre-wrap; }
    .footer { background: #f0e6d6; padding: 18px 32px; font-size: 12px; color: #7c6a5a; text-align: center; border-top: 1px solid #e0d2bf; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>New Website Enquiry</h2>
      <p>Chitwan Wood Craft — Handcrafted Wood from Nepal</p>
    </div>
    <div class="body">
      <div class="field-row">
        <div class="label">Customer Name</div>
        <div class="value">${sanitizeHtml(cleanName)}</div>
      </div>
      <div class="field-row">
        <div class="label">Phone / Viber</div>
        <div class="value"><a href="tel:${sanitizeHtml(cleanPhone)}" style="color:#b06f2b;text-decoration:none;font-weight:600;">${sanitizeHtml(cleanPhone)}</a></div>
      </div>
      <div class="field-row">
        <div class="label">Email Address</div>
        <div class="value"><a href="mailto:${sanitizeHtml(cleanEmail)}" style="color:#b06f2b;text-decoration:none;">${sanitizeHtml(cleanEmail)}</a></div>
      </div>
      <div class="field-row">
        <div class="label">What they need</div>
        <div class="value">${sanitizeHtml(cleanSubject)}</div>
      </div>
      <div class="field-row">
        <div class="label">Details &amp; Specifications</div>
        <div class="details-box">${sanitizeHtml(cleanDetails)}</div>
      </div>
    </div>
    <div class="footer">
      Submitted on ${submissionTime} via Chitwan Wood Craft Website
    </div>
  </div>
</body>
</html>
`;

    // 7. Deliver via Resend API
    if (env.RESEND_API_KEY) {
      const resendPayload = {
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: cleanEmail,
        subject: emailSubject,
        text: textContent,
        html: htmlContent
      };

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(resendPayload)
      });

      if (!emailResponse.ok) {
        const errData = await emailResponse.json().catch(() => ({}));
        // Server-side logging only — do NOT expose internal details to client
        console.error('[Resend Error Delivery Failed]', {
          status: emailResponse.status,
          error: errData,
          clientIp
        });
        return new Response(JSON.stringify({
          error: "Sorry, we couldn't send your enquiry right now. Please try again or contact us directly."
        }), {
          status: 502,
          headers: JSON_HEADERS
        });
      }

      const resData = await emailResponse.json().catch(() => ({}));
      return new Response(JSON.stringify({
        success: true,
        id: resData.id || undefined,
        message: 'Your enquiry has been sent successfully. Our team will contact you shortly.'
      }), {
        status: 200,
        headers: JSON_HEADERS
      });
    }

    // 8. CRITICAL ENVIRONMENT CHECK: Handle Missing RESEND_API_KEY
    if (isDev) {
      // Local development mode simulation ONLY
      console.log(`\n=======================================================\n[LOCAL DEV SIMULATION - EMAIL NOT SENT TO PROVIDER]\nTo: ${TO_EMAIL}\nFrom: ${FROM_EMAIL}\nReply-To: ${cleanEmail}\nSubject: ${emailSubject}\n${textContent}\n=======================================================\n`);

      return new Response(JSON.stringify({
        success: true,
        devMode: true,
        message: 'Your enquiry has been sent successfully (Dev Mode simulation).'
      }), {
        status: 200,
        headers: JSON_HEADERS
      });
    }

    // Production environment with missing RESEND_API_KEY: NEVER return success!
    console.error('[CRITICAL CONFIG ERROR] RESEND_API_KEY is not configured in production environment. Inquiries cannot be delivered.');
    return new Response(JSON.stringify({
      error: 'Our inquiry email service is temporarily undergoing maintenance. Please contact us directly via phone or WhatsApp.'
    }), {
      status: 503,
      headers: JSON_HEADERS
    });

  } catch (err) {
    console.error('[Contact API Internal Error]:', err);
    return new Response(JSON.stringify({
      error: 'An internal error occurred while processing your request. Please try again later.'
    }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}
