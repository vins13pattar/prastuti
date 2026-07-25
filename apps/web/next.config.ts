import type { NextConfig } from "next"
import { withWorkflow } from "workflow/next"

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    const development = process.env.NODE_ENV !== "production"
    const contentSecurityPolicy = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://*.clerk.accounts.dev https://*.clerk.com${development ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://api.razorpay.com https://*.ably.io https://*.ably.net https://*.ably-realtime.com wss://*.ably.io wss://*.ably.net wss://*.ably-realtime.com https://*.speech.microsoft.com wss://*.speech.microsoft.com${development ? " ws: wss:" : ""}`,
      "frame-src 'self' https://api.razorpay.com https://*.clerk.accounts.dev https://*.clerk.com",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ")

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
          },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ]
  },
}

export default withWorkflow(nextConfig)
