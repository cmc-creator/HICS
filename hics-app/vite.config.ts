// https://vite.dev/config/
export default async function createConfig() {
  const smokeMode = process.env.PLAYWRIGHT_SMOKE_MODE === '1'
  const plugins = []

  if (!smokeMode) {
    const [{ default: react }, { default: tailwindcss }] = await Promise.all([
      import('@vitejs/plugin-react'),
      import('@tailwindcss/vite'),
    ])

    plugins.push(react(), tailwindcss())
  }

  return {
    plugins,
    // Use root deployment by default; override for subpath hosting (e.g. GitHub Pages).
    base: process.env.VITE_BASE_PATH || '/',
  }
}
