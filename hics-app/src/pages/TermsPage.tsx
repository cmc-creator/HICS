import { Link } from 'react-router-dom';
import EnterpriseFooter from '../components/EnterpriseFooter';

const EFFECTIVE_DATE = 'January 1, 2026';
const COMPANY = 'NyxCollective LLC';
const PRODUCT = 'NyxHICSlab';
const EMAIL = 'legal@nyxcollective.io';

export default function TermsPage() {
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{PRODUCT} Terms of Service</h1>
            <p className="text-sm text-gray-500 dark:text-white/50 mt-1">Effective Date: {EFFECTIVE_DATE}</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">1. Acceptance of Terms</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              By accessing or using {PRODUCT} (the "Service"), provided by {COMPANY} ("we," "us," or "our"), you agree to be bound by these Terms of Service ("Terms"). If you are accessing the Service on behalf of an organization, you represent that you have authority to bind that organization to these Terms. If you do not agree, do not use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">2. Description of Service</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              {PRODUCT} is a software-as-a-service platform designed to provide Hospital Incident Command System (HICS) training, scenario simulation, quizzes, and related educational tools for healthcare organizations. The Service is intended for training purposes only and does not constitute medical, legal, or operational emergency guidance.
            </p>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Training Disclaimer</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                All content is for training purposes only. Always follow your facility's official Emergency Operations Plan for real incidents.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">3. Account Responsibilities</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">You are responsible for:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-white/70">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Promptly notifying us of any unauthorized use of your account</li>
              <li>Ensuring all users under your organization comply with these Terms</li>
            </ul>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              You may not share account credentials with individuals outside your licensed organization, create accounts for unauthorized users, or attempt to circumvent authentication controls.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">4. Subscriptions and Billing</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              Access to the Service is provided under a subscription agreement executed separately or through an authorized reseller. Fees are billed as specified in your order form. Failure to pay may result in suspension or termination of access. All fees are non-refundable except as explicitly stated in your subscription agreement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">5. Intellectual Property</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              The Service and all content, trademarks, logos, and technology therein are the exclusive property of {COMPANY} and protected by applicable intellectual property laws. {PRODUCT}, NyxCollective, and related marks are trademarks of {COMPANY}. You may not copy, modify, distribute, sell, or reverse-engineer any part of the Service without prior written consent.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">6. Acceptable Use</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-white/70">
              <li>Use the Service for any unlawful purpose</li>
              <li>Submit false or misleading information</li>
              <li>Attempt to gain unauthorized access to any system or data</li>
              <li>Interfere with the integrity or performance of the Service</li>
              <li>Use automated tools to scrape, mine, or extract data without authorization</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">7. Disclaimer of Warranties</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND. {COMPANY.toUpperCase()} EXPRESSLY DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">8. Limitation of Liability</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, {COMPANY.toUpperCase()} SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF REVENUE, PROFITS, OR DATA, ARISING OUT OF YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNTS PAID BY YOU IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">9. Termination</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              We may suspend or terminate your access to the Service at any time, with or without cause, with or without notice. Upon termination, your right to use the Service ceases immediately. Provisions that by their nature survive termination shall remain in effect.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">10. Governing Law</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              These Terms are governed by the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any disputes shall be resolved exclusively in the state or federal courts located in Delaware.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">11. Changes to Terms</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              We reserve the right to modify these Terms at any time. Material changes will be communicated by updating the Effective Date and, where appropriate, notifying account administrators. Continued use of the Service after changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">12. Contact</h2>
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              For questions regarding these Terms, contact us at:{' '}
              <a href={`mailto:${EMAIL}`} className="text-amber-700 dark:text-amber-400 hover:underline">{EMAIL}</a>
            </p>
          </section>

          <div className="border-t border-gray-200 dark:border-white/10 pt-4 flex gap-4 text-xs text-gray-500 dark:text-white/40">
            <Link to="/privacy" className="hover:underline text-amber-700 dark:text-amber-400">Privacy Policy</Link>
            <span>·</span>
            <Link to="/" className="hover:underline">Home</Link>
          </div>
        </div>
      </main>

      <EnterpriseFooter />
    </div>
  );
}
