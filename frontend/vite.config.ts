import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

  return {
    publicDir: 'public',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    assetsInclude: ['**/*.svg', '**/*.csv'],
    build: {
      // Target modern browsers for smaller output
      target: 'es2020',
      // Increase chunk size warning threshold (we control splits manually)
      chunkSizeWarningLimit: 600,
      // Enable CSS code splitting per chunk
      cssCodeSplit: true,
      // Minify with esbuild (default, but explicit)
      minify: 'esbuild',
      rollupOptions: {
        output: {
          // Smart manual chunk splitting  vendors in separate cacheable chunks
          manualChunks(id) {
            //  Heavy UI libs 
            if (id.includes('node_modules/@mui')) return 'vendor-mui';
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) return 'vendor-charts';
            if (id.includes('node_modules/pdfjs-dist')) return 'vendor-pdf';
            if (id.includes('node_modules/@capacitor')) return 'vendor-capacitor';

            //  Core React ecosystem 
            if (id.includes('node_modules/react-dom')) return 'vendor-react';
            if (id.includes('node_modules/react/')) return 'vendor-react';
            if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) return 'vendor-motion';

            //  Supabase 
            if (id.includes('node_modules/@supabase')) return 'vendor-supabase';

            //  Database / offline 
            if (id.includes('node_modules/dexie')) return 'vendor-dexie';

            //  Radix UI components 
            if (id.includes('node_modules/@radix-ui')) return 'vendor-radix';

            //  Utilities 
            if (id.includes('node_modules/date-fns')) return 'vendor-utils';
            if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
            if (id.includes('node_modules/sonner')) return 'vendor-utils';
            if (id.includes('node_modules/clsx') || id.includes('node_modules/tailwind-merge')) return 'vendor-utils';

            //  Fonts 
            if (id.includes('node_modules/@fontsource')) return 'vendor-fonts';
          },
          // Give chunks predictable names for better caching
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    optimizeDeps: {
      // Pre-bundle heavy deps so dev server starts faster
      include: [
        'react',
        'react-dom',
        'framer-motion',
        '@supabase/supabase-js',
        'dexie',
        'dexie-react-hooks',
        'lucide-react',
      ],
    },
    server: {
      port: 5173,
      host: true,
      hmr: {
        protocol: 'ws',
        host: 'localhost',
      },
      proxy: {
        '/api/v1': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
