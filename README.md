# HICS Training App

A Hospital Incident Command System (HICS) training application with interactive scenarios, role-based learning, and an AI-powered chatbot assistant.

## Features

### Dashboard

Overview of HICS structure, training modules, and quick access to all sections.

### HICS Roles & Interactive Org Chart

- Visual organizational chart with clickable role nodes
- 24 HICS positions across all sections
- Filter by section (Command, Operations, Planning, Logistics, Finance/Admin)
- Detailed role descriptions, responsibilities, and reporting relationships

### Training Scenarios (20 scenarios)

Expanding clinical and security decision-making across diverse emergency types:

- **Mass Casualty Incident (MCI)** - Intermediate, 5 steps
- **Hospital Fire Emergency** - Beginner, 3 steps (RACE protocol)
- **Hazardous Materials Exposure** - Advanced, 2 steps (decontamination zones)
- **Cyberattack / IT Outage** - Intermediate, 1 step (downtime procedures)
- **Psychiatric Emergency Transport During Lockdown** - Advanced, 3 steps
- **Mass Fatality Event Activation** - Advanced, 3 steps
- **Critical Resource Rationing During Surge** - Advanced, 3 steps
- Plus 6 additional scenarios covering power failure, pediatric surge, water contamination, supply disruption, bomb threats, and workplace violence

### Interactive Scenario Player

- Step-by-step decision trees with situational descriptions
- 4 answer choices with immediate feedback and explanations
- Hint system, progress tracking, and score review

### Knowledge Quiz (25 questions)

- Category filtering (HICS Structure, MCI, Fire Safety, HazMat, HIPAA, Planning, Safety, Triage, and more)
- Immediate answer feedback with detailed explanations
- Category performance breakdown and pass/fail result (80% threshold)
- Expanded coverage including organizational strategies, incident recovery, resource management, and psychological support

### AI Training Assistant (Chatbot)

- 26-topic HICS knowledge base (expanded)
- Covers: organizational structure, START triage, RACE protocol, hazmat zones, IAP, NIMS/ICS, HIPAA, span of control, psychiatric considerations, workforce resilience, family assistance centers, incident documentation, exercises & training, and more
- Suggested quick-questions, typing indicator, and markdown-formatted responses

## Tech Stack

- **React** + **TypeScript** + **Vite**
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **React Router v7**

## Getting Started

```bash
cd hics-app
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Build

```bash
cd hics-app
npm run build
```

The production build is output to `hics-app/dist/`.

## Deploy on Cloudflare Pages (Vercel Alternative)

This app can be hosted on Cloudflare Pages with a much lower cost profile for static traffic.

### Cloudflare Pages settings

- Framework preset: `Vite`
- Root directory: `hics-app`
- Build command: `npm run build`
- Build output directory: `dist`

### SPA routing support

The project includes `hics-app/public/_redirects` with:

```txt
/* /index.html 200
```

This ensures React Router routes work on hard refresh and direct URL access.

### Optional: deploy under a subpath

By default, Vite uses `/` as the base path (ideal for Cloudflare root domains).
If you need subpath hosting, set environment variable `VITE_BASE_PATH` during build, for example:

```bash
VITE_BASE_PATH=/HICS/ npm run build
```
