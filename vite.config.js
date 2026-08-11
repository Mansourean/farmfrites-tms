import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // A real literal (not a runtime env lookup) so the minifier can dead-code-eliminate
  // the demo-credentials array in LoginPage.jsx entirely when this is false — the
  // passwords must not just be hidden from the UI, they must not ship in the bundle.
  const enableDemoAccounts = env.VITE_ENABLE_DEMO_ACCOUNTS === 'true'

  return {
    define: {
      __ENABLE_DEMO_ACCOUNTS__: JSON.stringify(enableDemoAccounts),
    },
    build: {
      // No sourcemaps in shipped builds — keeps the artifact smaller and doesn't expose
      // original source to end users. Re-enable locally (`sourcemap: true`) when
      // debugging a production-only issue.
      sourcemap: false,
      rollupOptions: {
        output: {
          // Split framework code from app code so browsers cache the vendor chunk
          // across deploys (it only changes on a dependency bump, not on every release).
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (/react-router|react-dom|\/react\//.test(id)) return 'vendor'
            }
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        workbox: {
          // /assign/:token (the public WhatsApp transporter link) and /print/:id must always
          // reflect live server state -- a stale service worker on a device that has visited
          // the site before (this project has repeatedly hit stale-cache issues after a deploy)
          // must never be able to serve an old cached shell for either. Excluding them from the
          // SPA navigateFallback forces a genuine network request every time, same as a device
          // that has never visited the site at all.
          navigateFallbackDenylist: [/^\/assign\//, /^\/print\//],
        },
        manifest: {
          name: 'Farm Frites — Transportation Management System',
          short_name: 'Farm Frites TMS',
          description: 'Transportation Management System for Farm Frites KSA',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#1a1a19',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
  }
})
