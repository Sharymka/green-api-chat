import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Политика безопасности контента (CSP): браузер разрешит странице ходить только на серверы GREEN-API
 * и выполнять только наши собственные скрипты. Даже если в страницу как-то попадёт чужой код,
 * отправить токен на свой сервер он не сможет.
 * Добавляем только в сборку: в режиме разработки Vite использует встроенные скрипты и WebSocket.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Встроенные стили нужны React для атрибута style (например, цвет аватарки)
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  'connect-src https://*.greenapi.com https://*.green-api.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function securityMetaTags(): Plugin {
  return {
    name: 'security-meta-tags',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
      // Не сообщаем другим сайтам, с какой страницы к ним перешли
      {
        tag: 'meta',
        attrs: { name: 'referrer', content: 'no-referrer' },
        injectTo: 'head-prepend',
      },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages открывает сайт не в корне домена, а в папке с именем репозитория
  base: '/green-api-chat/',
  plugins: [react(), securityMetaTags()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
