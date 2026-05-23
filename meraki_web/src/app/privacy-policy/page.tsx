import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { MainNavbar } from '@/components/MainNavbar';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <MainNavbar />

      {/* ── Content ─────────────────────────────────────────────── */}
      <main className="flex-grow pt-16 pb-32 px-6 section-lavender relative overflow-hidden">
        <div className="blob-pink -top-20 -left-40 opacity-10" />
        
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-[family-name:var(--font-playfair)] italic text-[var(--color-text-primary)] mb-4">
              Privacy Policy
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">Last updated: April 2026</p>
          </div>

          <div className="bg-white p-8 sm:p-12 rounded-[var(--radius-3xl)] text-sm text-[var(--color-text-secondary)] space-y-8 leading-relaxed shadow-sm border border-gray-100">
            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">1. Introduction</h2>
              <p>
                Welcome to Merakí. We respect your privacy and are committed to protecting your personal data. 
                This privacy policy will inform you as to how we look after your personal data when you visit our website (regardless of where you visit it from) and tell you about your privacy rights and how the law protects you.
              </p>
            </section>
            
            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">2. The Data We Collect About You</h2>
              <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
                <li><strong>Contact Data</strong> includes billing address, delivery address, email address and telephone numbers.</li>
                <li><strong>Financial Data</strong> includes bank account and payment card details (securely handled by Stripe).</li>
                <li><strong>Transaction Data</strong> includes details about payments to and from you and other details of products and services you have purchased from us.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">3. How We Use Your Personal Data</h2>
              <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Where we need to perform the contract we are about to enter into or have entered into with you (e.g., booking a service).</li>
                <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
                <li>Where we need to comply with a legal obligation.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">4. Contact Details</h2>
              <p>If you have any questions about this privacy policy or our privacy practices, please contact us at <a href="mailto:privacy@merakiapp.com" className="text-[var(--color-primary)] font-semibold hover:underline">privacy@merakiapp.com</a>.</p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
