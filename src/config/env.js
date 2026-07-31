export const env = {
  mode: import.meta.env.MODE,
  isProduction: import.meta.env.PROD,
  isDevelopment: import.meta.env.DEV,

  // Base URL for a future REST/SAP backend (see src/services/api.js). Defaults to a
  // same-origin /api so the app works behind any reverse proxy without extra setup.
  apiUrl: import.meta.env.VITE_API_URL ?? '/api',

  // 'local' persists to the browser via localStorage (default); 'memory' keeps state
  // in-process only (data-less previews, automated tests). See src/services/storage.
  storageDriver: import.meta.env.VITE_STORAGE_DRIVER === 'memory' ? 'memory' : 'local',
}

// Whether the login screen's plaintext "Demo Accounts" quick-fill panel is enabled.
// This is a build-time constant (see __ENABLE_DEMO_ACCOUNTS__ in vite.config.js), not
// a runtime env lookup — VITE_ENABLE_DEMO_ACCOUNTS=false makes the minifier strip the
// passwords from the bundle entirely, not just hide them in the UI.
export const enableDemoAccounts = __ENABLE_DEMO_ACCOUNTS__
