import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import postcssRTLCSS from 'postcss-rtlcss';

// Urdu is written right to left. postcss-rtlcss mirrors our own styles (margins, padding, left / right,
// text-align ...): each left / right declaration is split into an English and an Urdu rule, chosen by
// the dir attribute on <html>. The rules use :where(), which adds no specificity, so the same rules
// win in both languages, exactly as in the source. The DataTables styles are mirrored the same way;
// the maps (Leaflet) stay left to right.
const rtl = postcssRTLCSS({
  mode: 'combined',
  ltrPrefix: ':where(html:not([dir="rtl"]))',
  rtlPrefix: ':where(html[dir="rtl"])',
  bothPrefix: ':where(html)',
});
const rtlForOurStyles = {
  postcssPlugin: 'marketlink-rtl',
  Once(root, helpers) {
    const file = root.source?.input?.file || '';
    if (/[\\/]src[\\/]styles[\\/]|[\\/]node_modules[\\/]datatables\.net-[\w-]+[\\/]css[\\/]/.test(file)) return rtl.Once(root, helpers);
    return undefined;
  },
};

// In development the React app runs on :5173 and forwards API / image requests to Express on :5000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
  css: {
    postcss: { plugins: [rtlForOurStyles] },
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3 still uses the older Sass syntax; hide those library warnings
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Only React itself is loaded up front. Charts, maps and DataTables are big, so they load
        // with the pages that use them; a slow connection gets the home page much sooner.
        // Higher priority groups pick their modules first (a group also takes its dependencies).
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|cookie|set-cookie-parser|clsx)[\\/]/, priority: 40 },
            { name: 'charts', test: /[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|es-toolkit|decimal\.js-light|eventemitter3|react-redux|@reduxjs|redux|reselect|immer|use-sync-external-store|tiny-invariant)[\\/]/, priority: 30 },
            { name: 'maps', test: /[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/, priority: 20 },
            { name: 'datatables', test: /[\\/]node_modules[\\/](datatables\.net[^\\/]*|jszip|jquery)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
