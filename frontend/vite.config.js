import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Updated to match your GitHub repository name: "ACE"
  base: process.env.NODE_ENV === 'production' ? '/ACE/' : '/',
})
