import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PLAYWRIGHT_PORT ?? '4173');
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const startScriptPath = fileURLToPath(new URL('./scripts/start-vite-playwright.ps1', import.meta.url));
// The PowerShell wrapper maps UNC paths to a drive on Windows; elsewhere start Vite directly.
const startCommand = process.platform === 'win32'
  ? `powershell -NoProfile -ExecutionPolicy Bypass -File "${startScriptPath}" -Port ${port}`
  : `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort --configLoader runner`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: startCommand,
        env: { PLAYWRIGHT_SMOKE_MODE: '1' },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 120000,
      },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});