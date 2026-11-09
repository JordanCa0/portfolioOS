import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import blogManifest from './blog-manifest';

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_URL ?? '/portfolioOS/',
  plugins: [react(), blogManifest()],
  define: {
    // react-rnd's bundled react-draggable reads process.env.NODE_ENV at
    // runtime, which doesn't exist in the browser
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
}));
