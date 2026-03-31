# NyxHICSlab Release Checklist

## Functional Smoke Test
- Open dashboard and verify module cards load.
- Run one scenario from Scenarios page.
- In Scenario Player: test facilitator mode, timed mode, and completion summary.
- Complete one quiz and verify answer feedback and results breakdown.
- Open Reports page and verify attempts table and CSV export.
- Confirm Facility Profile filtering updates scenario list and route context.

## Visual QA
- Validate in light and dark theme.
- Check mobile layout for navbar, filter panels, and answer cards.
- Verify hover/focus states are readable.
- Confirm animation timing feels smooth and non-blocking.

## Data/Tracking QA
- Confirm scenario completion appears in Reports.
- Confirm event counters increase after interactions.
- Confirm "Clear Data" resets attempts and events.

## Release Notes
- Update root CHANGELOG.md for release date and key features.
- Confirm commit history reflects shipped scope.

## Deployment
- Deploy main branch and hard-refresh live app.
