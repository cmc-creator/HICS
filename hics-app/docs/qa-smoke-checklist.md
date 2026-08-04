# NyxHICSlab QA Smoke Checklist

This checklist mirrors the current automated smoke coverage. All previously manual click-through checks have been folded into the Playwright suite.

## Public Routes

| Area | Action | Expected Result | Coverage |
| --- | --- | --- | --- |
| Landing | Open `/` | Marketing hero and enterprise CTAs render | Automated |
| Landing CTA | Click `Launch Enterprise Workspace` | Route changes to `/login` | Automated |
| Landing CTA | Click `Request Demo` | Route changes to `/request-demo` | Automated |
| Landing CTA | Click `Talk to Sales` | Route changes to `/request-demo` | Automated |
| Legal | Open `/tos` | Terms content renders | Automated |
| Legal | Open `/privacy` | Privacy content renders | Automated |
| Health | Open `/health` | API status panel renders | Automated |
| Health | Click `Re-run checks` | Checks refresh without route breakage | Automated |

## Authenticated Routes

| Area | Action | Expected Result | Coverage |
| --- | --- | --- | --- |
| Route Guard | Open `/dashboard` while signed out | Redirect to `/login` | Automated |
| Dashboard | Open `/dashboard` with seeded session | Dashboard hero and module cards render | Automated |
| Dashboard Stats | Click `Quiz Questions` stat card | Route changes to `/quiz` | Automated |
| Dashboard Stats | Click `Training Scenarios` stat card | Route changes to `/scenarios` | Automated |
| Dashboard Modules | Click `AI Training Assistant` card | Route changes to `/chatbot` | Automated |
| Dashboard Modules | Click `Training Reports` card | Route changes to `/reports` | Automated |
| Dashboard Modules | Click `Explore HICS Roles` card | Route changes to `/roles` | Automated |
| Dashboard Modules | Click `Facilitator Quick Start` card | Route changes to `/quick-start` | Automated |
| Navbar | Click each main nav item | Matching route opens and active state updates | Automated |
| Global Assistant | Open widget from dashboard | Assistant tray opens | Automated |
| Global Assistant | Send suggested prompt | Assistant response renders | Automated |
| Global Assistant | Click `Open full assistant page` | Route changes to `/chatbot` | Automated |
| Quick Start | Click `Open Scenarios` | Route changes to `/scenarios` | Automated |
| Quick Start | Click `Open Reports` | Route changes to `/reports` | Automated |
| Scenarios | Click first `Start Scenario` CTA | Route changes to `/scenarios/:id` | Automated |
| Scenario Player | Toggle facilitator and timed mode controls | Controls update and reveal additional actions | Automated |
| Scenario Player | Use hint and answer flow | Hint appears, answer selected, and next step advances | Automated |
| Scenario Player | Click `Back to Scenarios` | Returns to `/scenarios` with facility preserved | Automated |
| Reports | Click CSV export and certificate actions | Browser download/print flow starts | Automated |
| Reports | Click `Clear Data` with seeded records | Attempts clear and empty state renders | Automated |
| Admin | Open `/admin` as admin role | Admin controls render | Automated |
| Admin | Submit valid user invite form | User list refreshes or API request succeeds | Automated |

## Notes

- The smoke suite seeds localStorage auth and tenant values instead of using live SSO.
- The assistant endpoint is stubbed in-browser during smoke runs to keep the test deterministic.
- On this UNC-hosted workspace, use `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-smoke-tests.ps1` to mirror the app into a local temp directory and run the smoke suite there.
