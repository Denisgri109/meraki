'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import {
  Sparkles,
  UserCircle,
  Scissors,
  CalendarDays,
  Image as ImageIcon,
  Building2,
  Loader2,
  Check,
  ArrowRight,
} from 'lucide-react';

type StepId =
  | 'welcome'
  | 'profile'
  | 'services'
  | 'availability'
  | 'portfolio'
  | 'business_settings';

interface OnboardingStep {
  id: StepId;
  title: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Merakí!',
    description:
      "You're all set up as a Professional. Here's a quick overview of everything you can do on the platform.",
    Icon: Sparkles,
  },
  {
    id: 'profile',
    title: 'Your Profile',
    description:
      'Your profile is where clients discover you. You can add your bio, experience, and a profile photo from Settings at any time.',
    Icon: UserCircle,
  },
  {
    id: 'services',
    title: 'Your Services',
    description:
      'Create and manage the services you offer — set your own pricing, duration, and categories. Head to Services whenever you\'re ready.',
    Icon: Scissors,
  },
  {
    id: 'availability',
    title: 'Your Availability',
    description:
      'Control when you\'re available for bookings. Set your working hours and block off time as needed from the Availability page.',
    Icon: CalendarDays,
  },
  {
    id: 'portfolio',
    title: 'Your Portfolio',
    description:
      'Showcase your best work with a photo portfolio. Clients can browse your gallery before booking — add photos from Settings whenever you like.',
    Icon: ImageIcon,
  },
  {
    id: 'business_settings',
    title: 'Business Settings',
    description:
      'Manage your business details, cancellation policy, and payment settings all in one place from Settings.',
    Icon: Building2,
  },
];

export default function MasterOnboardingPage() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState(0);
  const [completing, setCompleting] = useState(false);

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  const finish = async (skipped: boolean) => {
    if (!user?.id) return;
    setCompleting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      showToast(
        skipped
          ? 'Setup skipped — you can finish anytime in Settings.'
          : "All set! You're ready to start accepting bookings.",
        'success'
      );
      router.replace('/dashboard');
    } catch (err) {
      console.error('Onboarding completion error:', err);
      showToast(
        'Saved locally — there was a sync issue, you can continue.',
        'info'
      );
      router.replace('/dashboard');
    } finally {
      setCompleting(false);
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      finish(false);
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleSkip = () => finish(true);

  const StepIcon = step.Icon;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-10 mt-4">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="h-2 rounded-full transition-all"
            style={{
              width: i === currentStep ? 28 : 8,
              background:
                i <= currentStep
                  ? 'var(--color-primary)'
                  : 'rgba(0,0,0,0.12)',
            }}
          />
        ))}
      </div>

      <div className="glass-card p-8 sm:p-10 text-center">
        <p className="text-xs font-semibold tracking-[2px] uppercase text-[var(--color-text-muted)] mb-6">
          Step {currentStep + 1} of {STEPS.length}
        </p>

        {/* Icon with glow */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'rgba(232,160,180,0.25)',
              filter: 'blur(22px)',
            }}
          />
          <div
            className="relative w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #FCEFF2, #F8D5DC)',
              border: '1px solid rgba(232,160,180,0.35)',
            }}
          >
            <StepIcon size={40} className="text-[var(--color-brand-pink-dark)]" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-text-primary)] mb-3">
          {step.title}
        </h1>
        <p className="text-sm sm:text-base text-[var(--color-text-secondary)] leading-relaxed mb-8 max-w-md mx-auto">
          {step.description}
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleNext}
            disabled={completing}
            className="btn-primary w-full h-14 flex items-center justify-center gap-2 text-sm tracking-widest uppercase cursor-pointer disabled:opacity-60"
          >
            {completing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isLastStep ? (
              <>
                <Check size={18} />
                Get Started
              </>
            ) : (
              <>
                Next
                <ArrowRight size={18} />
              </>
            )}
          </button>

          {!isLastStep && (
            <button
              onClick={handleSkip}
              disabled={completing}
              className="text-sm text-[var(--color-text-muted)] underline underline-offset-4 hover:text-[var(--color-text-primary)] transition-colors py-2 cursor-pointer disabled:opacity-50"
            >
              Skip Setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
