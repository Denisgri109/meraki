export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden">
      {/* ── Animated gradient mesh background ────────────────────────── */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(circle at 12% 18%, rgba(195,153,217,0.45) 0%, transparent 55%),' +
            'radial-gradient(circle at 88% 22%, rgba(230,164,180,0.55) 0%, transparent 55%),' +
            'radial-gradient(circle at 50% 92%, rgba(114,207,249,0.35) 0%, transparent 60%),' +
            'linear-gradient(180deg, #FFF8F9 0%, #FBF4F7 50%, #F5F0FA 100%)',
        }}
      />

      {/* ── Decorative blobs ─────────────────────────────────────────── */}
      <div
        aria-hidden
        className="blob-pink animate-float"
        style={{ top: '-80px', left: '-80px', opacity: 0.55 }}
      />
      <div
        aria-hidden
        className="blob-purple animate-float"
        style={{
          bottom: '-100px',
          right: '-80px',
          opacity: 0.5,
          animationDelay: '1.2s',
        }}
      />
      <div
        aria-hidden
        className="blob-mint"
        style={{ top: '40%', right: '-120px', opacity: 0.25 }}
      />

      {/* ── Centered glass card ──────────────────────────────────────── */}
      <div className="relative w-full max-w-[480px] animate-fade-in">
        <div
          className="w-full"
          style={{
            background: 'rgba(255,255,255,0.78)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.6)',
            borderRadius: 'var(--radius-2xl)',
            padding: '40px 32px',
            boxShadow:
              '0 20px 50px -10px rgba(167,139,250,0.18),' +
              '0 8px 24px -6px rgba(230,164,180,0.18),' +
              '0 0 0 1px rgba(255,255,255,0.4) inset',
          }}
        >
          {children}
        </div>

        {/* Tagline below card */}
        <p
          className="text-center mt-6 text-xs tracking-[0.3em] uppercase font-medium"
          style={{ color: 'rgba(0,0,0,0.35)' }}
        >
          Beauty With Soul
        </p>
      </div>
    </div>
  );
}
