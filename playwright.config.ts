import { defineConfig } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT || 4174)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PLAYWRIGHT_PORT')
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL,
    browserName: 'chromium',
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : undefined,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // Managed desktop sandboxes may not permit terminating a child server process.
  // In that case run the server explicitly and let tests reuse it without owning it.
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER === '1' ? undefined : {
    command: `pnpm dev --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...process.env,
      VITE_ZHIHU_LIVE: '0',
    },
  },
})
