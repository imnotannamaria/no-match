import type { NextConfig } from "next";

// Deliberately empty. The one thing that could have needed configuration
// here, the compiled alyze artifact, is served from public/ and loaded by
// URL inside the worker so the bundler never touches it. See CLAUDE.md,
// "Architecture".
const nextConfig: NextConfig = {};

export default nextConfig;
