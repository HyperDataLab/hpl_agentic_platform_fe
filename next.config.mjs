/**
 * A static export (`out/`) served by Firebase Hosting. There is no Next.js server: response headers, the
 * `/dashboard` redirect and the rewrites that serve `/projects/<id>/…` from the `_` placeholder pages live in
 * `firebase.json`.
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: "export",
  reactCompiler: true,
  images: { unoptimized: true },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default nextConfig;
