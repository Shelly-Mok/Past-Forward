import { defineConfig } from 'vite'
import { zhihuApiPlugin } from './server/vite-plugin.mjs'

export default defineConfig({
  plugins: [zhihuApiPlugin()],
  server: {
    host: '127.0.0.1',
    port: 4174,
  },
  preview: {
    host: '127.0.0.1',
    port: 4175,
  },
})
