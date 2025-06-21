import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React and related libraries
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          
          // Blockchain libraries
          if (id.includes('node_modules/ethers')) {
            return 'blockchain-vendor';
          }
          
          // UI libraries
          if (id.includes('node_modules/tailwindcss') || 
              id.includes('node_modules/framer-motion')) {
            return 'ui-vendor';
          }
          
          // Keep other chunks as they are
          return undefined;
        }
      }
    },
    // Increase the warning limit to avoid unnecessary warnings
    chunkSizeWarningLimit: 800
  },
})
