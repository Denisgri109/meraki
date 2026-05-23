'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, Mail, Lock, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError(null);
    setLoading(true);
    const { error: authError } = await signIn(email, password);
    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'rgba(0,0,0,0.3)',
    pointerEvents: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: 'rgba(0,0,0,0.45)',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    marginBottom: '8px',
    paddingLeft: '4px',
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <h1
            className="font-[family-name:var(--font-playfair)]"
            style={{
              fontSize: '52px',
              fontStyle: 'italic',
              color: 'var(--color-primary)',
              textShadow: '0 0 20px rgba(212, 138, 130, 0.35)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Merakí
          </h1>
          {/* Glow behind logo */}
          <div
            style={{
              position: 'absolute',
              inset: '-20px',
              background:
                'radial-gradient(circle, rgba(212,138,130,0.18), transparent 70%)',
              borderRadius: '9999px',
              filter: 'blur(20px)',
              zIndex: -1,
            }}
          />
          {/* Sparkle accent */}
          <Sparkles
            size={16}
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-22px',
              color: 'var(--color-brand-pink)',
            }}
          />
        </div>
        <p
          style={{
            marginTop: '14px',
            fontSize: '10px',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            color: 'var(--color-brand-pink-dark)',
            fontWeight: 600,
            opacity: 0.75,
          }}
        >
          Welcome Back
        </p>
        <p
          style={{
            marginTop: '8px',
            fontSize: '14px',
            color: 'rgba(0,0,0,0.45)',
          }}
        >
          Sign in to continue your journey
        </p>
      </div>

      {/* Login Form */}
      <form
        onSubmit={handleLogin}
        style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}
      >
        {error && (
          <div
            className="animate-fade-in"
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              fontSize: '14px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            {error}
          </div>
        )}

        {/* Email */}
        <div style={{ width: '100%' }}>
          <label style={labelStyle}>Email Address</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <Mail size={18} style={iconStyle} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              className="input-glass"
              style={{ paddingLeft: '44px', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Password */}
        <div style={{ width: '100%' }}>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <Lock size={18} style={iconStyle} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="input-glass"
              style={{
                paddingLeft: '44px',
                paddingRight: '48px',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(0,0,0,0.35)',
                padding: 0,
                display: 'flex',
              }}
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </div>

        {/* Forgot password */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Link
            href="/forgot-password"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-brand-pink-dark)',
              textDecoration: 'none',
            }}
          >
            Forgot Password?
          </Link>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{
            width: '100%',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : 'Sign In'}
        </button>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '8px 0 0',
          }}
        >
          <span style={{ height: '1px', flex: 1, background: 'rgba(0,0,0,0.08)' }} />
          <span
            style={{
              fontSize: '11px',
              color: 'rgba(0,0,0,0.35)',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            New to Merakí?
          </span>
          <span style={{ height: '1px', flex: 1, background: 'rgba(0,0,0,0.08)' }} />
        </div>

        {/* Register link */}
        <Link
          href="/register"
          style={{
            width: '100%',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: 'var(--color-primary)',
            border: '1.5px solid rgba(0,0,0,0.12)',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(255,255,255,0.6)',
            textDecoration: 'none',
            transition: 'all 0.2s ease',
          }}
          className="hover:border-[var(--color-primary)] hover:bg-white"
        >
          Create Account
        </Link>
      </form>
    </div>
  );
}
