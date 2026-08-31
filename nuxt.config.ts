// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-08-31',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Orlando Trip Planner',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Plan your Orlando theme-park trip: build a day-by-day itinerary, track your budget, and pack with confidence.',
        },
        { name: 'theme-color', content: '#0b3d91' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  /*
   * This project lives under a path that contains parentheses
   * ("iCloud Drive (Archive)"). Nuxt's component scanner escapes glob
   * metacharacters, but unimport's directory scan does not, so `composables/`
   * and `stores/` auto-imports silently come back empty. Registering them
   * explicitly makes the app build the same from any checkout path.
   */
  imports: {
    presets: [
      { from: '~/stores/trip', imports: ['useTripStore'] },
      { from: '~/composables/useFormat', imports: ['useFormat'] },
      { from: '~/composables/useHydrated', imports: ['useHydrated'] },
    ],
  },

  // Deploy target: Cloudflare Pages (Nitro output -> ./dist with _worker.js).
  nitro: {
    preset: 'cloudflare-pages',
    prerender: {
      crawlLinks: true,
      routes: ['/', '/itinerary', '/attractions', '/budget', '/packing', '/settings'],
    },
  },

  routeRules: {
    // App shell is fully client-driven from localStorage; prerender the markup.
    '/**': { prerender: true },
  },

  typescript: {
    strict: true,
  },
})
