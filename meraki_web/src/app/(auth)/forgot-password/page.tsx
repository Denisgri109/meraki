'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setError(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-brand-pink-light)] flex items-center justify-center">
          <Mail size={28} className="text-[var(--color-brand-pink-dark)]" />
        </div>
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-3">
          Check Your Email
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-8 leading-relaxed">
          We&apos;ve sent a password reset link to<br />
          <span className="font-medium text-[var(--color-text-primary)]">{email}</span>
        </p>
        <Link
          href="/login"
          className="btn-primary inline-flex items-center gap-2 px-8 h-12 text-sm tracking-widest uppercase"
        >
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="py-12">
      <Link
        href="/login"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        Back to Sign In
      </Link>

      <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
        Forgot Password?
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-8">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleReset} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-[var(--radius-lg)] animate-fade-in">
            {error}
          </div>
        )}

        <div>
          <label className="label-upper">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            className="input-glass"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full h-14 flex items-center justify-center gap-2 text-sm tracking-widest uppercase"
        >
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            'Send Reset Link'
          )}
        </button>
      </form>
    </div>
  );
}
