'use client';

import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { MainNavbar } from '@/components/MainNavbar';
import { Mail, Phone, Clock } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <MainNavbar />

      {/* ── Contact Content ─────────────────────────────────────── */}
      <main className="flex-grow pt-16 pb-32 px-6 section-warm relative overflow-hidden">
        <div className="blob-pink -top-20 -right-20 opacity-40 blur-3xl" />
        <div className="blob-purple -bottom-40 left-0 opacity-30 blur-3xl" />
        
        <div className="max-w-5xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-10 items-center">
          <div className="flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-50 border border-pink-100 w-fit mb-6 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">Get in Touch</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-[family-name:var(--font-playfair)] text-[var(--color-text-primary)] mb-6 leading-tight">
              Let's craft your <span className="italic text-[var(--color-primary)]">perfect</span> look.
            </h1>
            <p className="text-base text-[var(--color-text-secondary)] mb-10 leading-relaxed max-w-md">
              Have a question about our services, products, or your account? 
              We're here to help. Reach out to our dedicated support team to start your journey.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4 group">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-[var(--color-primary)] shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <Mail size={20} strokeWidth={1.5} />
                </div>
                <div className="pt-1">
                  <p className="text-sm font-bold text-[var(--color-text-primary)] mb-0.5">Email Us</p>
                  <a href="mailto:hello@merakiapp.com" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors">hello@merakiapp.com</a>
                </div>
              </div>
              <div className="flex items-start gap-4 group">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-[var(--color-primary)] shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <Phone size={20} strokeWidth={1.5} />
                </div>
                <div className="pt-1">
                  <p className="text-sm font-bold text-[var(--color-text-primary)] mb-0.5">Call Us</p>
                  <a href="tel:+4402071234567" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors">+44 (0) 20 7123 4567</a>
                </div>
              </div>
              <div className="flex items-start gap-4 group">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-[var(--color-primary)] shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <Clock size={20} strokeWidth={1.5} />
                </div>
                <div className="pt-1">
                  <p className="text-sm font-bold text-[var(--color-text-primary)] mb-0.5">Opening Hours</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">Mon-Fri, 9am - 6pm GMT</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative w-full max-w-lg mx-auto lg:ml-auto">
            {/* Decorative background blob for form */}
            <div className="absolute -inset-1 bg-gradient-to-r from-[var(--color-brand-pink-light)] to-[var(--color-brand-pink)] rounded-[var(--radius-3xl)] blur opacity-30" />
            
            <div className="glass-card relative bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-[var(--radius-3xl)] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-8">Send us a message</h3>
              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 ml-1">Name</label>
                  <input type="text" className="w-full px-5 py-3.5 rounded-2xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all shadow-sm placeholder:text-gray-400" placeholder="Jane Doe" required />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 ml-1">Email</label>
                  <input type="email" className="w-full px-5 py-3.5 rounded-2xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all shadow-sm placeholder:text-gray-400" placeholder="jane@example.com" required />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 ml-1">Message</label>
                  <textarea rows={5} className="w-full px-5 py-3.5 rounded-2xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all resize-none shadow-sm placeholder:text-gray-400" placeholder="How can we help you today?" required></textarea>
                </div>
                <div className="pt-2">
                  <button type="submit" className="w-full btn-pink py-4 rounded-2xl font-bold shadow-glow transition-all hover:translate-y-[-2px] hover:shadow-[0_8px_20px_rgba(232,160,180,0.3)] active:translate-y-[1px]">
                    Send Message
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
