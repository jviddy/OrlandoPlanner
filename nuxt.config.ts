// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt'],

  // The Nuxt persistedstate module defaults to cookies; the trip (up to 21 days
  // of plans) belongs in localStorage.
  piniaPluginPersistedstate: {
    storage: 'localStorage',
  },

  css: ['~/assets/css/main.css'],

  app: {
    pageTransition: { name: 'fade', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Orlando Trip Planner',
      meta: [
        { charset: 'utf-8' },
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1',
        },
        {
          name: 'description',
          content:
            'Plan an Orlando theme-park trip: see the whole holiday as a grid of days, set each day, and keep dining and fixed-time plans in one place.',
        },
        { name: 'theme-color', content: '#fdfaf3' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },

  /*
   * The checkout path contains parentheses ("iCloud Drive (Archive)"), which
   * breaks unimport's glob scan of composables/ and stores/. Nuxt's component
   * scanner escapes glob metacharacters; unimport does not. Register the few
   * we auto-use explicitly so the app builds from any path.
   */
  imports: {
    presets: [
      { from: '~/stores/trip', imports: ['useTripStore'] },
      { from: '~/composables/useDates', imports: ['useDates'] },
    ],
  },

  // Deploy target: Cloudflare Pages (Nitro output -> ./dist with _worker.js).
  nitro: {
    preset: 'cloudflare-pages',
    prerender: {
      crawlLinks: true,
      routes: ['/', '/new', '/templates', '/edit', '/day'],
    },
  },

  routeRules: {
    '/**': { prerender: true },
  },

  typescript: {
    strict: true,
  },
})
