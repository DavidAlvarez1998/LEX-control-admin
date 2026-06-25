import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build a self-contained server bundle (.next/standalone) for slim Docker images:
  // the runtime copies only the bundled server + the node_modules it actually needs.
  output: "standalone",
  experimental: {
    // Habilita la integración de la View Transitions API de React en el App Router:
    // las navegaciones de ruta pasan a ser transiciones y el <ViewTransition> de React
    // anima el cambio de página (crossfade por defecto). Degrada solo en navegadores
    // sin soporte (la app funciona, simplemente no anima).
    viewTransition: true,
  },
  // Proxy same-origin a la API: el navegador llama a /api/* (mismo host que este
  // front) y Next reenvía a la API del lado servidor. Así el navegador no necesita
  // alcanzar localhost:4000 directamente (clave en SSH donde solo se forwardean
  // 3000/3001). Destino configurable por env (API_PROXY_TARGET).
  async rewrites() {
    const target = process.env.API_PROXY_TARGET ?? "http://localhost:4000";
    return [{ source: "/api/:path*", destination: `${target}/:path*` }];
  },
};

export default nextConfig;
