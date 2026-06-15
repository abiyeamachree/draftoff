/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the shared workspace package (it ships raw TS).
  transpilePackages: ["@draftoff/shared"],
  // The shared package uses ESM-style ".js" specifiers in raw TS source,
  // so map ".js" requests onto the real ".ts"/".tsx" files when bundling.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
