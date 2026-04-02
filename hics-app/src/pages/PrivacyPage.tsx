import { Link } from 'react-router-dom';
import EnterpriseFooter from '../components/EnterpriseFooter';

const EFFECTIVE_DATE = 'January 1, 2026';
const COMPANY = 'NyxCollective LLC';
const PRODUCT = 'NyxHICSlab';
const EMAIL = 'privacy@nyxcollective.io';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <header className="nyx-hero text-white px-4 py-5 relative overflow-hidden">
        <div className="lux-grid-pattern" />
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-sm text-amber-100 hover:text-white">← Back to Home</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="nyx-panel p-8 space-y-8">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-gray-500 dark:text-white/50">LEGAL</p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{PRODUCT} Privacy Policy</h1>
            <p className="text-sm text-gray-500 dark:text-white/50 mt-1">Effective Date: {EFFECTIVE_DATE}</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">1. Overview</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              {COMPANY} ("we," "us," or "our") operates {PRODUCT} (the "Service"). This Privacy Policy explains how we collect, use, store, and protect information about users and organizations that access the Service. By using {PRODUCT}, you agree to the practices described in this policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">2. Information We Collect</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">We collect the following categories of information:</p>
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Account and Identity Data</p>
                <p className="text-xs text-gray-600 dark:text-white/60 mt-1">Name, work email, organization name, role, and authentication credentials. For SSO users, identity is provided by your employer's identity provider (Microsoft Entra or Okta) and we receive only what is included in the OIDC token (name, email, group claims).</p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Training Activity Data</p>
                <p className="text-xs text-gray-600 dark:text-white/60 mt-1">Scenario attempts, quiz scores, completion timestamps, session duration, and facilitator session records. This data is used to generate training reports and compliance records for your organization.</p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Usage and Technical Data</p>
                <p className="text-xs text-gray-600 dark:text-white/60 mt-1">IP addresses, browser type, device type, pages visited, and feature interaction events. Collected for security monitoring, performance optimization, and product improvement.</p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">AI Chatbot Conversations</p>
                <p className="text-xs text-gray-600 dark:text-white/60 mt-1">Messages sent to the NyxHICSlab AI Assistant are processed by our AI provider (OpenAI) under their data processing agreement. We do not use chatbot conversations to train AI models. Conversation history is session-scoped and not stored beyond your active session unless you explicitly save it.</p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Sales and Demo Inquiries</p>
                <p className="text-xs text-gray-600 dark:text-white/60 mt-1">Name, email, organization, and message content submitted through request-demo forms. Used solely to respond to your inquiry and qualify your organization for a product demonstration.</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">3. How We Use Information</h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-white/70">
              <li>Provide, maintain, and improve the Service</li>
              <li>Authenticate users and enforce session security</li>
              <li>Generate training records and compliance exports for your organization</li>
              <li>Detect and prevent fraud, abuse, and unauthorized access</li>
              <li>Respond to support requests and account inquiries</li>
              <li>Send transactional emails (password resets, account alerts)</li>
              <li>Analyze aggregate usage trends to improve product quality</li>
            </ul>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              We do not sell your personal data. We do not use personal data for targeted advertising.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">4. Data Sharing</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              We share data only with:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-white/70">
              <li><strong>Your organization's administrators</strong> - who have access to facility-scoped training records and user management</li>
              <li><strong>Service providers</strong> - including cloud infrastructure (Vercel), AI processing (OpenAI), and identity providers (Microsoft Entra, Okta) under data processing agreements</li>
              <li><strong>Legal authorities</strong> - when required by law, court order, or to protect our legal rights</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">5. Data Security</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              We implement industry-standard security controls including TLS encryption in transit, access controls, security headers (HSTS, CSP, X-Frame-Options), and session management with inactivity timeouts. Authentication is performed via OIDC PKCE flows with enterprise identity providers where configured.
            </p>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              No system is completely secure. In the event of a data breach that affects your personal information, we will notify affected organizations as required by applicable law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">6. Data Retention</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              Training records and account data are retained for the duration of your organization's active subscription plus 90 days, unless a longer retention period is required by law or agreed in your subscription contract. Account administrators may request earlier deletion of facility-scoped training data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">7. Your Rights</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              Depending on your location, you may have the right to access, correct, or delete your personal data, object to processing, or request data portability. Submit requests to:{' '}
              <a href={`mailto:${EMAIL}`} className="text-amber-700 dark:text-amber-400 hover:underline">{EMAIL}</a>.
              We will respond within 30 days.
            </p>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              For users whose data is controlled by their employer (enterprise SSO), please direct requests to your organization's IT or HR department, as they are the data controller for employment-related records.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">8. Cookies and Local Storage</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              {PRODUCT} uses browser localStorage to store your session token, theme preference, and training attempt history. We do not use third-party tracking cookies or advertising trackers. OIDC state parameters are stored in sessionStorage and cleared after login completes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">9. Children's Privacy</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              The Service is intended for healthcare professionals and is not directed at individuals under the age of 18. We do not knowingly collect personal information from minors.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">10. Changes to This Policy</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              We may update this Privacy Policy periodically. Material changes will be communicated by updating the Effective Date above and notifying account administrators where appropriate. Continued use of the Service constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">11. Contact</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              Privacy inquiries:{' '}
              <a href={`mailto:${EMAIL}`} className="text-amber-700 dark:text-amber-400 hover:underline">{EMAIL}</a>
              <br />
              {COMPANY} · Legal Department
            </p>
          </section>

          <div className="border-t border-gray-200 dark:border-white/10 pt-4 flex gap-4 text-xs text-gray-500 dark:text-white/40">
            <Link to="/tos" className="hover:underline text-amber-700 dark:text-amber-400">Terms of Service</Link>
            <span>·</span>
            <Link to="/" className="hover:underline">Home</Link>
          </div>
        </div>
      </main>

      <EnterpriseFooter />
    </div>
  );
}
