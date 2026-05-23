'use client';

import { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Loader2, ShieldCheck, CheckCircle2, ArrowLeft } from 'lucide-react';

const OTP_LENGTH = 6;

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') ?? '';
  const supabase = createClient();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleVerify = useCallback(
    async (codeOverride?: string) => {
      const code = codeOverride ?? otp.join('');

      if (code.length !== OTP_LENGTH) {
        setError('Please enter the full 6-digit code');
        return;
      }

      if (!emailParam) {
        setError('Missing email. Please go back and register again.');
        return;
      }

      setError(null);
      setLoading(true);

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: emailParam,
        token: code,
        type: 'signup',
      });

      setLoading(false);

      if (verifyError) {
        setError(verifyError.message || 'Invalid or expired code. Please try again.');
        // Reset OTP on failure (matches mobile UX)
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        return;
      }

      // Success — show success state briefly, then redirect
      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 900);
    },
    [otp, emailParam, supabase, router]
  );

  const handleChange = (index: number, value: string) => {
    // Handle paste of full code
    if (value.length > 1) {
      const chars = value.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
      if (chars.length === 0) return;
      const newOtp = Array(OTP_LENGTH).fill('');
      chars.forEach((char, i) => {
        if (i < OTP_LENGTH) newOtp[i] = char;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(chars.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      if (chars.length === OTP_LENGTH) {
        handleVerify(newOtp.join(''));
      }
      return;
    }

    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (digit && index === OTP_LENGTH - 1) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === OTP_LENGTH) {
        handleVerify(fullOtp);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending || !emailParam) return;
    setResending(true);
    setError(null);

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: emailParam,
    });

    setResending(false);

    if (resendError) {
      setError(resendError.message || 'Failed to resend code. Please try again.');
      return;
    }
    setResendCooldown(60);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify();
  };

  // ── Success state ─────────────────────────────────────────────────
  if (success) {
    return (
      <div className="py-8 text-center animate-fade-in">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: 'rgba(52,211,153,0.18)', filter: 'blur(20px)' }}
          />
          <div
            className="relative w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6EE7B7, #10B981)' }}
          >
            <CheckCircle2 size={36} className="text-white" strokeWidth={2.5} />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
          Email Verified
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Welcome to Merakí. Redirecting you now…
        </p>
      </div>
    );
  }

  return (
    <div className="py-2 text-center">
      {/* Back link */}
      <div className="flex justify-start mb-6">
        <Link
          href="/register"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </Link>
      </div>

      {/* Icon with glow */}
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: 'rgba(232,160,180,0.25)', filter: 'blur(22px)' }}
        />
        <div
          className="relative w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #FCEFF2, #F8D5DC)',
            border: '1px solid rgba(232,160,180,0.35)',
          }}
        >
          <ShieldCheck size={34} className="text-[var(--color-brand-pink-dark)]" strokeWidth={2.2} />
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
        Verify Your Email
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-1">
        We&apos;ve sent a 6-digit code to
      </p>
      <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-8 break-all">
        {emailParam || 'your email'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-[var(--radius-lg)] animate-fade-in text-left">
            {error}
          </div>
        )}

        {/* OTP Input */}
        <div className="flex justify-center gap-2 sm:gap-3">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={loading}
              className="otp-input"
              style={{
                width: 'clamp(40px, 12vw, 52px)',
                height: 'clamp(48px, 14vw, 60px)',
                textAlign: 'center',
                fontSize: '22px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                background: digit ? '#FFFFFF' : 'var(--color-surface-input)',
                border: `2px solid ${digit ? 'var(--color-brand-pink)' : 'rgba(0,0,0,0.06)'}`,
                borderRadius: 'var(--radius-lg)',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxShadow: digit ? '0 0 0 4px rgba(232,160,180,0.12)' : 'none',
              }}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full h-14 flex items-center justify-center gap-2 text-sm tracking-widest uppercase"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : 'Verify'}
        </button>
      </form>

      <div className="mt-6 text-sm">
        <span className="text-[var(--color-text-muted)]">Didn&apos;t receive a code? </span>
        {resendCooldown > 0 ? (
          <span className="text-[var(--color-text-muted)]">Resend in {resendCooldown}s</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="font-semibold text-[var(--color-brand-pink-dark)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50"
            type="button"
          >
            {resending ? 'Sending…' : 'Resend Code'}
          </button>
        )}
      </div>

      <div className="mt-4">
        <Link
          href="/login"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center">
          <Loader2 size={28} className="mx-auto animate-spin text-[var(--color-brand-pink-dark)]" />
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
