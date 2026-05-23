'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import {
  ArrowLeft, Inbox, CheckCircle2, Clock, Loader2, X, Send,
  Image, FileText, ChevronRight, Eye, Filter, GraduationCap,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Submission {
  id: string;
  lesson_id: string;
  student_id: string;
  photo_url: string;
  notes: string | null;
  status: string | null;
  feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  lesson_title?: string;
  course_title?: string;
  student_name?: string;
  student_email?: string;
}

type FilterStatus = 'all' | 'pending' | 'reviewed';

export default function HomeworkInboxPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  useEffect(() => {
    if (role && role !== 'owner') router.replace('/dashboard/academy');
  }, [role, router]);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');

  // Review modal
  const [reviewing, setReviewing] = useState<Submission | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    if (!user) return;
    try {
      // Get all courses by this instructor
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title')
        .eq('instructor_id', user.id);

      if (!courses || courses.length === 0) { setSubmissions([]); setLoading(false); return; }

      const courseIds = courses.map((c) => c.id);
      const courseMap = new Map(courses.map((c) => [c.id, c.title]));

      // Get lessons for these courses
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('id, title, course_id')
        .in('course_id', courseIds);

      const lessonMap = new Map((lessonsData || []).map((l: any) => [l.id, { title: l.title, course_id: l.course_id }]));
      const lessonIds = (lessonsData || []).map((l: any) => l.id);

      if (lessonIds.length === 0) { setSubmissions([]); setLoading(false); return; }

      // Get homework submissions
      const { data: subs } = await supabase
        .from('homework_submissions')
        .select('*, student:profiles!homework_submissions_student_id_fkey(full_name, email)')
        .in('lesson_id', lessonIds)
        .order('created_at', { ascending: false });

      const mapped: Submission[] = (subs || []).map((s: any) => {
        const lessonInfo = lessonMap.get(s.lesson_id);
        return {
          ...s,
          lesson_title: lessonInfo?.title || 'Unknown Lesson',
          course_title: lessonInfo ? courseMap.get(lessonInfo.course_id) || 'Unknown Course' : 'Unknown Course',
          student_name: s.student?.full_name || 'Unknown',
          student_email: s.student?.email || '',
        };
      });

      setSubmissions(mapped);
    } catch (err) {
      console.error('[Homework] fetch error:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const filtered = submissions.filter((s) => {
    if (filter === 'pending') return s.status !== 'reviewed';
    if (filter === 'reviewed') return s.status === 'reviewed';
    return true;
  });

  const openReview = (s: Submission) => {
    setReviewing(s);
    setFeedbackText(s.feedback || '');
  };

  const submitFeedback = async () => {
    if (!reviewing || !user) return;
    if (!feedbackText.trim()) { showToast('Write some feedback', 'error'); return; }
    setSending(true);
    try {
      const { error } = await supabase.from('homework_submissions').update({
        feedback: feedbackText.trim(),
        status: 'reviewed',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', reviewing.id);
      if (error) throw error;
      showToast('Feedback sent', 'success');
      setReviewing(null);
      fetchSubmissions();
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setSending(false);
    }
  };

  const pendingCount = submissions.filter((s) => s.status !== 'reviewed').length;

  return (
    <div className="animate-fade-in pb-20">
      {/* Header */}
      <button onClick={() => router.push('/dashboard/academy')} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Academy
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Inbox size={20} className="text-amber-500" />
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-[var(--color-text-muted)]">Homework</span>
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Homework Inbox</h1>
          {pendingCount > 0 && (
            <p className="text-sm text-amber-600 font-semibold mt-1">{pendingCount} pending review</p>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {(['pending', 'reviewed', 'all'] as FilterStatus[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${filter === f ? 'bg-white shadow text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="shimmer h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-4 animate-float">
            <CheckCircle2 size={32} className="text-amber-500" />
          </div>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">
            {filter === 'pending' ? 'All caught up!' : 'No submissions yet'}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            {filter === 'pending' ? 'No pending homework submissions to review' : 'Homework submissions will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const isPending = s.status !== 'reviewed';
            return (
              <div
                key={s.id}
                onClick={() => openReview(s)}
                className="glass-card p-5 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group"
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${isPending ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-emerald-400 to-green-500'}`}>
                  {s.student_name?.charAt(0) || '?'}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{s.student_name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {isPending ? 'Pending' : 'Reviewed'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                    {s.course_title} → {s.lesson_title}
                  </p>
                </div>
                {/* Photo indicator */}
                {s.photo_url && <Image size={16} className="text-[var(--color-text-muted)] shrink-0" />}
                {/* Date */}
                <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                  {s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}
                </span>
                <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Review Modal ── */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto" onClick={() => setReviewing(null)}>
          <div className="glass-card w-full max-w-xl p-6 shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Review Submission</h2>
              <button onClick={() => setReviewing(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><X size={18} /></button>
            </div>

            {/* Student info */}
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-gray-50">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                {reviewing.student_name?.charAt(0) || '?'}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{reviewing.student_name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{reviewing.student_email}</p>
              </div>
            </div>

            {/* Course / Lesson */}
            <div className="text-xs text-[var(--color-text-muted)] mb-4">
              <span className="font-semibold">{reviewing.course_title}</span> → {reviewing.lesson_title}
              {reviewing.created_at && <span className="ml-2">· {new Date(reviewing.created_at).toLocaleString()}</span>}
            </div>

            {/* Photo */}
            {reviewing.photo_url && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Submitted Photo</p>
                <a href={reviewing.photo_url} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={reviewing.photo_url} alt="Homework submission" className="rounded-xl max-h-64 object-cover border border-[var(--color-border)]" />
                </a>
              </div>
            )}

            {/* Notes */}
            {reviewing.notes && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">Student Notes</p>
                <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap p-3 rounded-lg bg-gray-50">{reviewing.notes}</p>
              </div>
            )}

            {/* Feedback */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">Your Feedback</p>
              <textarea
                className="input-glass w-full min-h-[120px] resize-y"
                placeholder="Write your feedback to the student..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setReviewing(null)} className="flex-1 px-4 py-2.5 rounded-xl font-semibold bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={submitFeedback} disabled={sending} className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Send Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
