import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Giochi: pagine HTML statiche in public/giochi con indirizzo pulito
      { source: '/giochi/salto-matto', destination: '/giochi/salto-matto.html' },
    ]
  },
  async headers() {
    return [
      {
        source: '/api/telegram/webhook',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, GET, OPTIONS' },
        ],
      },
    ]
  },
};

export default nextConfig;
