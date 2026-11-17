import { Link } from 'react-router-dom';
import EnterpriseFooter from '../components/EnterpriseFooter';

const COMPANY = 'Nyx Collective LLC';
const PRODUCT = 'NyxHICSlab';
const EMAIL = 'info@nyxcollectivellc.com';

// Public account-deletion page (store requirement: Google Play and
// the Apple App Store both require a web page where users can
// request account deletion without signing in). There is no in-app
// self-serve delete button - deletion is handled by verified email
// request, which is the process described here. The wording matches
// the Privacy Policy: requests answered within 30 days, and
// organization training records follow the retention terms there
// (active subscription plus 90 days, or the organization's
// contract), with personal identifiers removed on deletion.
export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-gray-50 lux-page">
      <header className="nyx-hero text-white px-4 py-5 relative overflow-hidden">
        <div className="lux-grid-pattern" />
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-sm text-amber-100 hover:text-white">← Back to Home</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="nyx-panel p-8 space-y-8 relaxed-copy">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-gray-500 dark:text-white/50">ACCOUNT</p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">Delete Your {PRODUCT} Account</h1>
            <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
              How to request deletion of your account and personal data
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">1. How to request deletion</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              Send an email to{' '}
              <a href={`mailto:${EMAIL}?subject=Delete%20my%20NyxHICSlab%20account`} className="text-amber-700 dark:text-amber-400 hover:underline">{EMAIL}</a>{' '}
              from the email address on your {PRODUCT} account, with:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-white/70">
              <li>Subject: "Delete my NyxHICSlab account"</li>
              <li>The email address on the account</li>
              <li>Your organization or facility name, if your account belongs to one</li>
            </ul>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              Sending the request from your account email address is how we verify the request is really
              yours. If you cannot send from that address, tell us in the message and we will verify your
              identity another way before deleting anything.
            </p>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              If your account was created by your organization's administrator, you can also ask that
              administrator to contact us on your behalf.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">2. If you sign in with Google</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              The same email request deletes your {PRODUCT} account. Deleting your {PRODUCT} account does
              not affect your Google account in any way, and you do not need to change anything in Google.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">3. What gets deleted</h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-white/70">
              <li>Your sign-in account: name, email address, password credentials, and security settings</li>
              <li>Your personal profile and preferences</li>
              <li>Your personal training activity (scenario attempts, quiz results, and progress) is deleted or stripped of your name and email so it can no longer be linked to you</li>
            </ul>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              One exception: healthcare organizations are required to keep training and compliance records.
              Records your organization must retain under its subscription contract or the law are kept for
              the retention period described in our{' '}
              <Link to="/privacy" className="text-amber-700 dark:text-amber-400 hover:underline">Privacy Policy</Link>{' '}
              (the active subscription plus 90 days), with your personal identifiers removed. Deleting your
              account never deletes your organization's records for other users.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">4. What happens next, and when</h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-white/70">
              <li>We confirm receipt of your request by reply email</li>
              <li>Your sign-in is disabled while the request is processed, so the account cannot be used</li>
              <li>Deletion is completed within 30 days of verification, and we email you when it is done</li>
              <li>Deletion is permanent and cannot be undone; a deleted account cannot be recovered</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">5. Closing an organization account</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              Administrators who need to close an entire facility or organization account (for example at
              the end of a contract) can contact us at{' '}
              <a href={`mailto:${EMAIL}`} className="text-amber-700 dark:text-amber-400 hover:underline">{EMAIL}</a>.
              A full data export and a complete data wipe are available to enterprise administrators for
              contract-end closeout.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">6. Contact</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              Account and privacy requests:{' '}
              <a href={`mailto:${EMAIL}`} className="text-amber-700 dark:text-amber-400 hover:underline">{EMAIL}</a>
              <br />
              {COMPANY}
            </p>
          </section>

          <div className="border-t border-gray-200 dark:border-white/10 pt-4 flex gap-4 text-xs text-gray-500 dark:text-white/40">
            <Link to="/privacy" className="hover:underline text-amber-700 dark:text-amber-400">Privacy Policy</Link>
            <span>·</span>
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
