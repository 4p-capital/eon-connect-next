import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remover console.log/warn em produção (melhora performance significativamente)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error'] }
      : false,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pvndddmbppepbllpioab.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },

  // Otimizar pacotes pesados para tree-shaking
  serverExternalPackages: [],

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "motion",
      "react-day-picker",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },

  // Comprimir output
  compress: true,

  // Headers de segurança
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            // Permite câmera na própria origem (leitura de QR no painel de
            // recebimento). Mic/geo continuam desabilitados por padrão.
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
