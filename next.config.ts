import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo desarrollo: permite abrir la app desde el celular en la misma red.
  allowedDevOrigins: ["192.168.0.17", "192.168.0.*", "10.0.0.*"],
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  experimental: {
    // La tabla y el perfil traen pocas filas; comprimir el payload del router
    // ayuda en conexiones móviles del campus.
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    const seguridad = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
    ];
    return [
      { source: "/:path*", headers: seguridad },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
