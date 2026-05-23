import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { MainNavbar } from '@/components/MainNavbar';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <MainNavbar />

      {/* ── Content ─────────────────────────────────────────────── */}
      <main className="flex-grow pt-16 pb-32 px-6 section-warm relative overflow-hidden">
        <div className="blob-purple -bottom-40 right-0 opacity-10" />
        
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-[family-name:var(--font-playfair)] italic text-[var(--color-text-primary)] mb-4">
              Terms of Service
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">Last updated: April 2026</p>
          </div>

          <div className="bg-white p-8 sm:p-12 rounded-[var(--radius-3xl)] text-sm text-[var(--color-text-secondary)] space-y-8 leading-relaxed shadow-sm border border-gray-100">
            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Merakí (the "Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
              </p>
            </section>
            
            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">2. Description of Service</h2>
              <p>
                Merakí is a platform connecting users with beauty professionals, allowing users to book appointments, purchase beauty products, and access educational courses. We reserve the right to modify or discontinue, temporarily or permanently, the Service with or without notice.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">3. User Accounts</h2>
              <p>
                To use certain features of the Service, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate. You are responsible for safeguarding your password and for all activities that occur under your account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">4. Booking and Cancellations</h2>
              <p>
                When booking a service, you agree to the respective professional's cancellation policy. Deposits may be required for certain services. Late cancellations or no-shows may result in forfeiture of deposits or additional fees as specified at the time of booking.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">5. Contact Information</h2>
              <p>If you have any questions regarding these Terms, please contact us at <a href="mailto:legal@merakiapp.com" className="text-[var(--color-primary)] font-semibold hover:underline">legal@merakiapp.com</a>.</p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
