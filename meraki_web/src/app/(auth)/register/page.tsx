'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  validateIrishPhone,
  formatIrishPhone,
  validateEmail,
  validatePassword,
  validateFullName,
} from '@/lib/validation';
import {
  Loader2,
  User,
  Scissors,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Phone,
  ShieldCheck,
  Check,
} from 'lucide-react';

type FieldErrors = {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const supabase = createClient();

  const searchParams = useSearchParams();
  const invitedEmail = searchParams.get('email') || '';
  const invitedRole = searchParams.get('role');
  const isInvited = searchParams.get('invited') === 'true';

  const [selectedRole, setSelectedRole] = useState<UserRole>(
    invitedRole === 'master' ? 'master' : 'client'
  );
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState<string | null>(null);

  // Password strength meter (matches mobile)
  const strength = useMemo(() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  }, [password]);

  const strengthLabel = strength <= 2 ? 'Weak' : strength <= 3 ? 'Medium' : 'Strong';
  const strengthColor = strength <= 2 ? '#EF4444' : strength <= 3 ? '#F59E0B' : '#10B981';

  const validate = (): boolean => {
    const next: FieldErrors = {};

    const nameRes = validateFullName(fullName);
    if (!nameRes.valid) next.fullName = nameRes.error;

    // Phone is optional — only validate when provided (matches mobile)
    if (phone.trim()) {
      const phoneRes = validateIrishPhone(phone);
      if (!phoneRes.valid) next.phone = phoneRes.error;
    }

    const emailRes = validateEmail(email);
    if (!emailRes.valid) next.email = emailRes.error;

    const passwordRes = validatePassword(password);
    if (!passwordRes.valid) next.password = passwordRes.error;

    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handlePhoneBlur = () => {
    if (phone.trim()) {
      const v = validateIrishPhone(phone);
      if (v.valid) setPhone(formatIrishPhone(phone));
    }
  };

  const clearError = (field: keyof FieldErrors) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setTopError(null);

    if (!validate()) return;
    if (!tosAccepted) {
      setTopError('Please accept the Terms of Service to continue.');
      return;
    }

    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const { error: signUpError } = await signUp(
      normalizedEmail,
      password,
      fullName.trim(),
      selectedRole,
      tosAccepted,
      '1.0'
    );

    if (signUpError) {
      setLoading(false);
      let msg = signUpError.message || 'An error occurred during registration.';
      if (msg.includes('Database error')) {
        msg = 'Database error creating account. Please try again or contact support.';
      } else if (msg.includes('already registered') || msg.includes('already exists')) {
        msg = 'This email is already registered. Please sign in instead.';
      } else if (msg.toLowerCase().includes('password')) {
        msg = 'Password is too weak. Please use at least 6 characters.';
      }
      setTopError(msg);
      return;
    }

    // Mirror mobile: explicitly resend the signup OTP to ensure delivery
    await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
    });

    setLoading(false);
    router.push(`/verify?email=${encodeURIComponent(normalizedEmail)}`);
  };

  // ─── Styles ─────────────────────────────────────────────
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

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'rgba(0,0,0,0.3)',
    pointerEvents: 'none',
  };

  const fieldErrorStyle: React.CSSProperties = {
    color: '#DC2626',
    fontSize: '12px',
    marginTop: '6px',
    paddingLeft: '4px',
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <h1
          className="font-[family-name:var(--font-playfair)]"
          style={{
            fontSize: '44px',
            fontStyle: 'italic',
            color: 'var(--color-primary)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Merakí
        </h1>
        <p
          style={{
            marginTop: '6px',
            fontSize: '10px',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: 'var(--color-brand-pink-dark)',
            fontWeight: 600,
            opacity: 0.75,
          }}
        >
          Create Your Account
        </p>
        <p style={{ marginTop: '10px', fontSize: '14px', color: 'rgba(0,0,0,0.45)' }}>
          Join the Merakí community
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleRegister}
        style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}
      >
        {isInvited && (
          <div
            style={{
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.25)',
              color: '#7C3AED',
              fontSize: '14px',
              padding: '14px 16px',
              borderRadius: 'var(--radius-lg)',
              lineHeight: '1.5',
            }}
            className="animate-fade-in"
          >
            <strong>You&apos;ve been invited!</strong> Create your account to get started as a Merakí professional.
          </div>
        )}

        {topError && (
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              fontSize: '14px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-lg)',
            }}
            className="animate-fade-in"
          >
            {topError}
          </div>
        )}

        {/* Role Selection */}
        <div style={{ width: '100%' }}>
          <label style={labelStyle}>I am a...</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Client */}
            <button
              type="button"
              onClick={() => { if (!isInvited) setSelectedRole('client'); }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                padding: '18px',
                borderRadius: 'var(--radius-xl)',
                border: `2px solid ${
                  selectedRole === 'client' ? 'var(--color-primary)' : 'rgba(0,0,0,0.06)'
                }`,
                background:
                  selectedRole === 'client' ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background:
                    selectedRole === 'client' ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User
                  size={22}
                  style={{
                    color: selectedRole === 'client' ? 'var(--color-primary)' : 'rgba(0,0,0,0.3)',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: selectedRole === 'client' ? 700 : 600,
                  color: selectedRole === 'client' ? 'var(--color-primary)' : 'rgba(0,0,0,0.5)',
                }}
              >
                Client
              </span>
            </button>
            {/* Professional */}
            <button
              type="button"
              onClick={() => { if (!isInvited) setSelectedRole('master'); }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                padding: '18px',
                borderRadius: 'var(--radius-xl)',
                border: `2px solid ${
                  selectedRole === 'master' ? 'var(--color-primary)' : 'rgba(0,0,0,0.06)'
                }`,
                background:
                  selectedRole === 'master' ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background:
                    selectedRole === 'master' ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Scissors
                  size={22}
                  style={{
                    color: selectedRole === 'master' ? 'var(--color-primary)' : 'rgba(0,0,0,0.3)',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: selectedRole === 'master' ? 700 : 600,
                  color: selectedRole === 'master' ? 'var(--color-primary)' : 'rgba(0,0,0,0.5)',
                }}
              >
                Professional
              </span>
            </button>
          </div>
        </div>

        {/* Full Name */}
        <div style={{ width: '100%' }}>
          <label style={labelStyle}>Full Name</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <User size={18} style={iconStyle} />
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                clearError('fullName');
              }}
              placeholder="Julianne Moore"
              autoComplete="name"
              autoCapitalize="words"
              className="input-glass"
              style={{
                paddingLeft: '44px',
                width: '100%',
                boxSizing: 'border-box',
                borderColor: errors.fullName ? '#FCA5A5' : undefined,
              }}
            />
          </div>
          {errors.fullName && <p style={fieldErrorStyle}>{errors.fullName}</p>}
        </div>

        {/* Phone */}
        <div style={{ width: '100%' }}>
          <label style={labelStyle}>Phone Number</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <Phone size={18} style={iconStyle} />
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                clearError('phone');
              }}
              onBlur={handlePhoneBlur}
              placeholder="+353 87 123 4567"
              autoComplete="tel"
              className="input-glass"
              style={{
                paddingLeft: '44px',
                width: '100%',
                boxSizing: 'border-box',
                borderColor: errors.phone ? '#FCA5A5' : undefined,
              }}
            />
          </div>
          {errors.phone && <p style={fieldErrorStyle}>{errors.phone}</p>}
        </div>

        {/* Email */}
        <div style={{ width: '100%' }}>
          <label style={labelStyle}>Email Address</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <Mail size={18} style={iconStyle} />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                if (!isInvited) {
                  setEmail(e.target.value);
                  clearError('email');
                }
              }}
              readOnly={isInvited}
              placeholder="name@example.com"
              autoComplete="email"
              className="input-glass"
              style={{
                paddingLeft: '44px',
                width: '100%',
                boxSizing: 'border-box',
                borderColor: errors.email ? '#FCA5A5' : undefined,
                ...(isInvited ? { opacity: 0.7, cursor: 'default' } : {}),
              }}
            />
          </div>
          {errors.email && <p style={fieldErrorStyle}>{errors.email}</p>}
        </div>

        {/* Password */}
        <div style={{ width: '100%' }}>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <Lock size={18} style={iconStyle} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError('password');
              }}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
              className="input-glass"
              style={{
                paddingLeft: '44px',
                paddingRight: '48px',
                width: '100%',
                boxSizing: 'border-box',
                borderColor: errors.password ? '#FCA5A5' : undefined,
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
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
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>

          {errors.password && <p style={fieldErrorStyle}>{errors.password}</p>}

          {/* Password Strength Meter */}
          {password.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '10px',
                paddingLeft: '4px',
                paddingRight: '4px',
              }}
            >
              <div style={{ display: 'flex', flex: 1, gap: '4px' }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    style={{
                      height: '4px',
                      flex: 1,
                      borderRadius: '2px',
                      background: i <= strength ? strengthColor : 'rgba(0,0,0,0.08)',
                      transition: 'background 0.3s',
                    }}
                  />
                ))}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: strengthColor,
                  textTransform: 'uppercase',
                  minWidth: '50px',
                  textAlign: 'right',
                }}
              >
                {strengthLabel}
              </span>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div style={{ width: '100%' }}>
          <label style={labelStyle}>Confirm Password</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <ShieldCheck size={18} style={iconStyle} />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearError('confirmPassword');
              }}
              placeholder="••••••••"
              autoComplete="new-password"
              className="input-glass"
              style={{
                paddingLeft: '44px',
                width: '100%',
                boxSizing: 'border-box',
                borderColor: errors.confirmPassword ? '#FCA5A5' : undefined,
              }}
            />
          </div>
          {errors.confirmPassword && <p style={fieldErrorStyle}>{errors.confirmPassword}</p>}
        </div>

        {/* TOS — custom checkbox to match mobile */}
        <div
          role="checkbox"
          aria-checked={tosAccepted}
          tabIndex={0}
          onClick={() => setTosAccepted(!tosAccepted)}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              setTosAccepted(!tosAccepted);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            cursor: 'pointer',
            userSelect: 'none',
            marginTop: '4px',
            outline: 'none',
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              border: `2px solid ${
                tosAccepted ? 'var(--color-primary)' : 'rgba(0,0,0,0.18)'
              }`,
              background: tosAccepted ? 'var(--color-primary)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              marginTop: '1px',
            }}
          >
            {tosAccepted && <Check size={13} color="#fff" strokeWidth={3} />}
          </span>
          <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.6)', lineHeight: '20px' }}>
            I agree to the{' '}
            <Link
              href="/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                color: 'var(--color-brand-pink-dark)',
                fontWeight: 600,
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >
              Terms of Service
            </Link>{' '}
            &amp;{' '}
            <Link
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                color: 'var(--color-brand-pink-dark)',
                fontWeight: 600,
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >
              Privacy Policy
            </Link>
          </span>
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
            marginTop: '8px',
          }}
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : 'Create Account'}
        </button>

        {/* Sign in link */}
        <p
          style={{
            textAlign: 'center',
            fontSize: '14px',
            color: 'rgba(0,0,0,0.45)',
            marginTop: '4px',
          }}
        >
          Already have an account?{' '}
          <Link
            href="/login"
            style={{
              fontWeight: 700,
              color: 'var(--color-primary)',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            }}
          >
            Sign In
          </Link>
        </p>
      </form>
    </div>
  );
}
