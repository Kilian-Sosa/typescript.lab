// One reviewed site pair for both artifacts, their response policies and activation.
export const PRODUCTION_ORIGINS = Object.freeze({
  app: 'https://typescript-lab-app-preview.vercel.app',
  runner: 'https://typescript-lab-runner-preview.vercel.app',
});

export function validateProductionEnvironment(env: Record<string, string | undefined>, needsAuth: boolean) {
  if (env.VERCEL_ENV !== 'production' || env.VERCEL_TARGET_ENV !== 'production') {
    throw new Error('Explicit Production metadata requires VERCEL_ENV=production and VERCEL_TARGET_ENV=production.');
  }
  for (const [key, expected] of [
    ['VITE_RUNNER_PARENT_ORIGIN', PRODUCTION_ORIGINS.app],
    ['VITE_RUNNER_ORIGIN', PRODUCTION_ORIGINS.runner],
  ] as const) {
    if (env[key] !== undefined && env[key] !== expected) {
      throw new Error(`Production origin conflicts with the reviewed configuration: ${key}.`);
    }
  }
  if (env.LAB_RUNNER_LOCAL_TEST) throw new Error('Production cannot use local runner configuration.');
  if (!needsAuth) return { ...PRODUCTION_ORIGINS, supabaseOrigin: '', publishableKey: '' };
  const raw = env.VITE_SUPABASE_URL;
  if (
    !raw ||
    !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(raw) ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '')
  ) {
    throw new Error('Production requires an exact HTTPS Supabase origin and public publishable key.');
  }
  return {
    ...PRODUCTION_ORIGINS,
    supabaseOrigin: new URL(raw).origin,
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY!,
  };
}

export function productionAppHeaders(supabaseOrigin: string): Record<string, string> {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseOrigin)) throw new Error('Invalid Supabase origin for CSP.');
  const supabase = new URL(supabaseOrigin);
  return {
    'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://avatars.githubusercontent.com; connect-src ${supabase.origin} wss://${supabase.hostname}; frame-src ${PRODUCTION_ORIGINS.runner}; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  };
}
