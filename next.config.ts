import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: [],
  
  // Optimize development mode
  experimental: {
    // Enable optimized package imports
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'lucide-react',
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-wallets',
      'framer-motion',
    ],
    // Reduce memory usage
    webpackMemoryOptimizations: true,
  },
  
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  
  // Moved from experimental.serverComponentsExternalPackages
  serverExternalPackages: ['privacycash'],
  
  webpack: (config, { isServer, dev }) => {
    // Exclude TypeScript declaration files from webpack processing (must be first)
    config.module.rules.unshift({
      test: /\.d\.ts$/,
      use: 'null-loader'
    });
    
    // Exclude test files and Anchor.toml from being processed
    config.module.rules.push({
      test: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
      use: 'null-loader'
    });
    
    config.module.rules.push({
      test: /Anchor\.toml$/,
      use: 'null-loader'
    });
    
    // Exclude entire program folder (Solana programs, Rust code, etc.)
    config.module.rules.push({
      test: /program\//,
      use: 'null-loader'
    });
    
    // Exclude dun-protocol test directory completely
    config.module.rules.push({
      test: /dun-protocol\/sdk\/test\//,
      use: 'null-loader'
    });
    
    // Exclude Rust and Solana-specific files
    config.module.rules.push({
      test: /\.(rs|toml|so)$/,
      use: 'null-loader'
    });
    
    // Handle snarkjs and circomlibjs for browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        os: false,
        readline: false,
        worker_threads: false,
      };
    }
    
    // Ignore specific problematic files and directories
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/dun-protocol/sdk/test': false,
      '@/program': false,
    };
    
    // Optimize watch options for faster rebuilds
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/program/**',
        '**/dun-protocol/target/**',
        '**/dun-protocol-public/**',
        '**/.kiro/**',
        '**/artifacts/**',
        '**/cache/**',
        '**/tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      // Reduce CPU usage
      aggregateTimeout: 300,
      poll: false,
    };
    
    // Development optimizations
    if (dev) {
      // Reduce the number of chunks for faster rebuilds
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
    }
    
    return config;
  },
};

export default nextConfig;
