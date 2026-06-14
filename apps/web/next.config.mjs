/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the shared workspace package (it ships raw TS).
  transpilePackages: ["@draftoff/shared"],
};

export default nextConfig;
