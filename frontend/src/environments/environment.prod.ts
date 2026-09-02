export const environment = {
  production: true,
  // Mismo origen: /api se proxyea a Railway desde Vercel (ver vercel.json).
  // Así las cookies del refresh son SAME-SITE (funcionan en móvil y desktop)
  // en vez de cross-site (que los navegadores móviles bloquean).
  apiUrl: '/api',
};
