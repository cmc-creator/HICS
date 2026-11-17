import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted brand fonts (UI review P14): the previous stack
// named Aptos, which only exists on some Windows machines, so
// most devices silently rendered a fallback. Inter is the body
// face; Libre Franklin is the display face for headings/brand.
// Bundled by Vite and served from our own origin, so the CSP
// font-src 'self' policy holds.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/libre-franklin/600.css'
import '@fontsource/libre-franklin/700.css'
import '@fontsource/libre-franklin/800.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
