import { expect, test } from '@playwright/test';

const authSession = {
  user: {
    fullName: 'Smoke Test User',
    email: 'smoke@example.com',
    organization: 'Nyx Test Health',
    mfaEnabled: true,
    plan: 'enterprise',
  },
  accessToken: 'smoke-access-token',
  authMethod: 'password',
  expiresAt: Date.now() + 60 * 60 * 1000,
  lastActivityAt: Date.now(),
};

async function seedAuthenticatedSession(page: import('@playwright/test').Page, role = 'facility-admin') {
  await page.addInitScript(
    ({ session, tenantRole }) => {
      window.sessionStorage.setItem('nyx-auth-session', JSON.stringify(session));
      window.localStorage.setItem('nyx-tenant-role', tenantRole);
      window.localStorage.setItem('nyx-tenant-facility', 'psychiatric-inpatient');
      window.localStorage.setItem('nyx-tenant-display-name', 'North Campus Behavioral Health');
      window.localStorage.setItem('nyx-first-run-complete', 'true');
    },
    { session: authSession, tenantRole: role },
  );
}

async function seedTrainingData(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const attempts = [
      {
        id: 'attempt-1',
        scenarioId: 'mass-casualty',
        scenarioTitle: 'Mass Casualty Incident (MCI)',
        facility: 'psychiatric-inpatient',
        correctAnswers: 4,
        totalSteps: 5,
        scorePercent: 80,
        timedMode: true,
        facilitatorMode: true,
        durationSeconds: 780,
        completedAt: '2026-04-02T15:10:00.000Z',
      },
      {
        id: 'attempt-2',
        scenarioId: 'fire-evacuation',
        scenarioTitle: 'Fire and Evacuation Response',
        facility: 'psychiatric-inpatient',
        correctAnswers: 5,
        totalSteps: 5,
        scorePercent: 100,
        timedMode: false,
        facilitatorMode: false,
        durationSeconds: 640,
        completedAt: '2026-04-02T16:00:00.000Z',
      },
    ];

    const events = [
      { id: 'event-1', event: 'scenario_start_click', at: '2026-04-02T15:00:00.000Z' },
      { id: 'event-2', event: 'scenario_completed', at: '2026-04-02T15:20:00.000Z' },
      { id: 'event-3', event: 'scenario_completed', at: '2026-04-02T16:10:00.000Z' },
    ];

    localStorage.setItem('nyx-training-attempts', JSON.stringify(attempts));
    localStorage.setItem('nyx-training-events', JSON.stringify(events));
  });
}

test('public routes and CTAs resolve', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Launch Enterprise Workspace' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request Demo' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Talk to Sales' })).toBeVisible();

  await page.getByRole('link', { name: 'Launch Enterprise Workspace' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'Request Demo' }).first().click();
  await expect(page).toHaveURL(/\/request-demo$/);
  await expect(page.getByRole('heading', { name: /Request Enterprise Demo/i })).toBeVisible();

  await page.goto('/tos');
  await expect(page.getByRole('heading', { name: /Terms of Service/i })).toBeVisible();

  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: /Privacy Policy/i })).toBeVisible();

  await page.goto('/health');
  await expect(page.getByRole('heading', { name: /API Endpoint Status/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Re-run checks/i })).toBeVisible();
});

test('protected routes redirect anonymous users to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
});

test('dashboard cards and module links navigate correctly', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: /Platform Modules/i })).toBeVisible();

  await page.getByRole('link', { name: /^\d+\s+Quiz Questions$/i }).click();
  await expect(page).toHaveURL(/\/quiz$/);

  await page.goto('/dashboard');
  await page.getByRole('link', { name: /^\d+\s+Training Scenarios$/i }).click();
  await expect(page).toHaveURL(/\/scenarios$/);

  await page.goto('/dashboard');
  await page.getByRole('link', { name: /AI Training Assistant/i }).click();
  await expect(page).toHaveURL(/\/chatbot$/);

  await page.goto('/dashboard');
  await page.getByRole('link', { name: /CSV Export Training Reports/i }).click();
  await expect(page).toHaveURL(/\/reports$/);

  await page.goto('/dashboard');
  await page.getByRole('link', { name: /Explore HICS Roles/i }).click();
  await expect(page).toHaveURL(/\/roles$/);

  await page.goto('/dashboard');
  await page.getByRole('link', { name: /Facilitator Quick Start/i }).click();
  await expect(page).toHaveURL(/\/quick-start$/);
});

test('quick start and reports actions are wired', async ({ page }) => {
  await seedAuthenticatedSession(page, 'facility-admin');
  await seedTrainingData(page);

  await page.addInitScript(() => {
    const opened: string[] = [];
    Object.defineProperty(window, '__smokeOpenedWindows', {
      value: opened,
      configurable: true,
      writable: false,
    });

    window.open = (...args) => {
      opened.push(String(args[0] ?? ''));
      return {
      document: {
        open() {},
        write() {},
        close() {},
      },
      focus() {},
      print() {},
      } as unknown as Window;
    };
  });

  await page.goto('/quick-start');
  await expect(page.getByRole('heading', { name: /Facilitator Quick Start/i })).toBeVisible();
  await page.getByRole('link', { name: /Open Scenarios/i }).click();
  await expect(page).toHaveURL(/\/scenarios$/);

  await page.goto('/quick-start');
  await page.getByRole('link', { name: /Open Reports/i }).click();
  await expect(page).toHaveURL(/\/reports$/);

  await page.goto('/reports');
  await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
  await expect(page.getByText('Mass Casualty Incident (MCI)')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export CSV/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^nyxhicslab-training-report-\d{4}-\d{2}-\d{2}\.csv$/);

  await page.getByRole('button', { name: /Completion Certificate/i }).click();
  await expect.poll(async () => page.evaluate(() => (window as typeof window & { __smokeOpenedWindows: string[] }).__smokeOpenedWindows.length)).toBe(1);
  await page.getByRole('button', { name: /Clear Data/i }).click();
  await expect(page.getByText(/No completed scenario attempts yet\./i)).toBeVisible();
});

test('scenario player, admin access, and assistant widget are wired', async ({ page }) => {
  await seedAuthenticatedSession(page, 'enterprise-admin');

  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: 'Stub assistant reply' }),
    });
  });

  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Need Help\? Ask AI/i }).click();
  await expect(page.getByText('Live help from any module')).toBeVisible();
  await page.getByRole('button', { name: /How do I run a 30-minute drill\?/i }).click();
  await expect(page.getByText('Stub assistant reply')).toBeVisible();
  await page.getByRole('link', { name: /Open full assistant page/i }).click();
  await expect(page).toHaveURL(/\/chatbot$/);

  await page.goto('/scenarios');
  await expect(page.getByRole('heading', { name: /NyxHICSlab Scenarios/i })).toBeVisible();
  await page.getByRole('link', { name: /Start Scenario/i }).first().click();
  await expect(page).toHaveURL(/\/scenarios\/.+/);

  await page.goto('/scenarios/mass-casualty?facility=psychiatric-inpatient');
  await expect(page.getByText(/Step 1 of 5/i)).toBeVisible();

  await page.locator('button', { hasText: 'Facilitator Mode: Off' }).click();
  await expect(page.locator('button', { hasText: 'Facilitator Mode: On' })).toBeVisible();
  await page.locator('button', { hasText: 'Timed Mode: Off' }).click();
  await expect(page.locator('button', { hasText: 'Timed Mode: On' })).toBeVisible();
  await page.locator('button', { hasText: 'Reveal Correct Answer' }).click();
  await expect(page.getByText(/Facilitator Reveal/i)).toBeVisible();
  await page.locator('button', { hasText: 'Hint: Show' }).click();
  await expect(page.getByText(/Think about the chain of command/i)).toBeVisible();
  await page.locator('button', { hasText: 'Notify the Hospital Administrator and initiate HICS activation' }).click();
  await expect(page.locator('button', { hasText: 'Next Step' })).toBeVisible();
  await page.locator('button', { hasText: 'Next Step' }).click();
  await expect(page.getByText(/Step 2 \| HICS Activation/i)).toBeVisible();
  await page.getByRole('link', { name: /Back to Scenarios/i }).click();
  await expect(page).toHaveURL(/\/scenarios\?facility=psychiatric-inpatient$/);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /Facility Administration/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Add User/i })).toBeVisible();
});

test('navbar highlights active route for each nav item', async ({ page }) => {
  await seedAuthenticatedSession(page, 'enterprise-admin');
  const navRoutes = [
    { path: '/roles', label: 'HICS Roles' },
    { path: '/scenarios', label: 'Scenarios' },
    { path: '/quiz', label: 'Quiz' },
    { path: '/learning-center', label: 'Learning Center' },
    { path: '/rapid-challenge', label: 'Rapid Challenge' },
    { path: '/live-drill', label: 'Live Drill' },
    { path: '/quick-start', label: 'Quick Start' },
    { path: '/reports', label: 'Reports' },
    { path: '/chatbot', label: 'AI Assistant' },
    { path: '/admin', label: 'Admin' },
  ];

  for (const { path, label } of navRoutes) {
    await page.goto(path);
    const activeLink = page.locator(`a.lux-nav-active`, { hasText: label });
    await expect(activeLink).toBeVisible();
  }
});

test('admin invite form submits successfully', async ({ page }) => {
  await seedAuthenticatedSession(page, 'enterprise-admin');

  await page.route('**/api/admin/users', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ users: [] }) });
    } else {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'new-user-1',
            fullName: 'Jane Doe',
            email: 'jane.doe@example.com',
            role: 'facilitator',
            facility: 'psychiatric-inpatient',
          },
        }),
      });
    }
  });

  await page.route('**/api/audit/logs', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ logs: [] }) });
  });

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /Facility Administration/i })).toBeVisible();

  await page.fill('#new-user-name', 'Jane Doe');
  await page.fill('#new-user-email', 'jane.doe@example.com');
  await page.selectOption('#new-user-role', 'facilitator');

  await page.getByRole('button', { name: /Add User/i }).click();
  await expect(page.getByRole('button', { name: /Add User/i })).toBeEnabled();
});

test('learning center, quiz, chatbot, rapid challenge, and live drill render correctly', async ({ page }) => {
  await seedAuthenticatedSession(page, 'enterprise-admin');

  await page.route('**/api/training/media**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mediaAssets: [] }) });
  });

  await page.route('**/api/training/rapid-challenge**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leaderboard: [] }) });
  });

  await page.route('**/api/training/live-drills**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ session: null }) });
  });

  await page.goto('/learning-center');
  await expect(page.getByRole('heading', { name: /Video-Style Storyboard Academy/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reset Learning Progress/i })).toBeVisible();

  await page.goto('/quiz');
  await expect(page.getByRole('heading', { name: /NyxHICSlab Knowledge Quiz/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Start Quiz/i })).toBeVisible();

  await page.goto('/chatbot');
  await expect(page.getByRole('heading', { name: /NyxHICSlab Assistant/i })).toBeVisible();
  await expect(page.getByPlaceholder(/Ask about HICS protocols/i)).toBeVisible();

  await page.goto('/rapid-challenge');
  await expect(page.getByRole('heading', { name: /Rapid Triage Challenge/i })).toBeVisible();
  await expect(page.getByText(/Time Left:/i)).toBeVisible();

  await page.goto('/live-drill');
  await expect(page.getByRole('heading', { name: /Live Drill Control Room/i })).toBeVisible();
  await expect(page.getByText(/Session:/i)).toBeVisible();
});