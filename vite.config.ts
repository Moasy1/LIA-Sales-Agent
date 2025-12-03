
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      'process.env': {
        API_KEY: env.API_KEY || "AIzaSyA2q-2Bas3ueDR6tnrmI_kh83X8sskLO30", // Fallback to ensure it works
        VITE_BACKEND_URL: env.VITE_BACKEND_URL || "https://lia-sales-agent.vercel.app" 
      }
    },
  };
});
