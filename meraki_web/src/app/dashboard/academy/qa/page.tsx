'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import {
  ArrowLeft, MessageCircle, Send, Loader2, X, ChevronRight,
  GraduationCap, CheckCircle2, Clock,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Question {
  id: string;
  lesson_id: string;
  course_id: string;
  sender_id: string;
  content: string | null;
  is_question: boolean | null;
  parent_message_id: string | null;
  created_at: string | null;
  sender_name?: string;
  sender_email?: string;
  lesson_title?: string;
  course_title?: string;
  reply_count?: number;
}

interface Reply {
  id: string;
  content: string | null;
  sender_id: string;
  created_at: string | null;
  sender_name?: string;
  is_instructor?: boolean;
}

export default function QAInboxPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  useEffect(() => {
    if (role && role !== 'owner') router.replace('/dashboard/academy');
  }, [role, router]);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'unanswered' | 'answered' | 'all'>('unanswered');

  // Detail / reply
  const [selected, setSelected] = useState<Question | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const replyEndRef = useRef<HTMLDivElement>(null);

  const fetchQuestions = useCallback(async () => {
    if (!user) return;
    try {
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title')
        .eq('instructor_id', user.id);

      if (!courses || courses.length === 0) { setQuestions([]); setLoading(false); return; }

      const courseIds = courses.map((c) => c.id);
      const courseMap = new Map(courses.map((c) => [c.id, c.title]));

      // Get lessons
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('id, title, course_id')
        .in('course_id', courseIds);
      const lessonMap = new Map((lessonsData || []).map((l: any) => [l.id, { title: l.title, course_id: l.course_id }]));

      // Get top-level questions (is_question=true, no parent)
      const { data: msgs } = await supabase
        .from('lesson_qa_messages')
        .select('*, sender:profiles!lesson_qa_messages_sender_id_fkey(full_name, email)')
        .in('course_id', courseIds)
        .eq('is_question', true)
        .is('parent_message_id', null)
        .order('created_at', { ascending: false });

      // Count replies for each question
      const questionIds = (msgs || []).map((m: any) => m.id);
      let replyCounts = new Map<string, number>();
      if (questionIds.length > 0) {
        const { data: replyData } = await supabase
          .from('lesson_qa_messages')
          .select('parent_message_id')
          .in('parent_message_id', questionIds);
        (replyData || []).forEach((r: any) => {
          replyCounts.set(r.parent_message_id, (replyCounts.get(r.parent_message_id) || 0) + 1);
        });
      }

      const mapped: Question[] = (msgs || []).map((m: any) => {
        const lessonInfo = lessonMap.get(m.lesson_id);
        return {
          ...m,
          sender_name: m.sender?.full_name || 'Unknown',
          sender_email: m.sender?.email || '',
          lesson_title: lessonInfo?.title || 'Unknown Lesson',
          course_title: courseMap.get(m.course_id) || 'Unknown Course',
          reply_count: replyCounts.get(m.id) || 0,
        };
      });

      setQuestions(mapped);
    } catch (err) {
      console.error('[Q&A] fetch error:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const filtered = questions.filter((q) => {
    if (filter === 'unanswered') return (q.reply_count || 0) === 0;
    if (filter === 'answered') return (q.reply_count || 0) > 0;
    return true;
  });

  const openQuestion = async (q: Question) => {
    setSelected(q);
    setRepliesLoading(true);
    try {
      const { data } = await supabase
        .from('lesson_qa_messages')
        .select('*, sender:profiles!lesson_qa_messages_sender_id_fkey(full_name)')
        .eq('parent_message_id', q.id)
        .order('created_at');

      setReplies((data || []).map((r: any) => ({
        ...r,
        sender_name: r.sender?.full_name || 'Unknown',
        is_instructor: r.sender_id === user?.id,
      })));
    } catch { setReplies([]); }
    finally { setRepliesLoading(false); }
  };

  const sendReply = async () => {
    if (!user || !selected || !replyText.trim()) return;
    setReplying(true);
    try {
      const { error } = await supabase.from('lesson_qa_messages').insert({
        lesson_id: selected.lesson_id,
        course_id: selected.course_id,
        sender_id: user.id,
        content: replyText.trim(),
        is_question: false,
        parent_message_id: selected.id,
      });
      if (error) throw error;
      setReplyText('');
      showToast('Reply sent', 'success');

      // Refresh replies
      const { data } = await supabase
        .from('lesson_qa_messages')
        .select('*, sender:profiles!lesson_qa_messages_sender_id_fkey(full_name)')
        .eq('parent_message_id', selected.id)
        .order('created_at');
      setReplies((data || []).map((r: any) => ({
        ...r, sender_name: r.sender?.full_name || 'Unknown', is_instructor: r.sender_id === user.id,
      })));
      fetchQuestions();
      setTimeout(() => replyEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setReplying(false);
    }
  };

  const unansweredCount = questions.filter((q) => (q.reply_count || 0) === 0).length;

  // ── Detail view ──
  if (selected) {
    return (
      <div className="animate-fade-in pb-20 max-w-3xl mx-auto">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Q&A Inbox
        </button>

        <div className="glass-card p-6 mb-6">
          {/* Question header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {selected.sender_name?.charAt(0) || '?'}
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{selected.sender_name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {selected.course_title} → {selected.lesson_title}
                {selected.created_at && <span> · {new Date(selected.created_at).toLocaleString()}</span>}
              </p>
            </div>
          </div>
          {/* Question content */}
          <p className="text-[var(--color-text-primary)] whitespace-pre-wrap">{selected.content}</p>
        </div>

        {/* Replies */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border-light)]">
            <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Replies</h3>
          </div>

          <div className="p-4 max-h-[400px] overflow-y-auto space-y-3">
            {repliesLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" /></div>
            ) : replies.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-6">No replies yet. Be the first to respond!</p>
            ) : (
              replies.map((r) => (
                <div key={r.id} className={`p-3 rounded-xl text-sm ${r.is_instructor ? 'bg-violet-50 border border-violet-200 ml-8' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold ${r.is_instructor ? 'text-violet-600' : 'text-[var(--color-text-muted)]'}`}>
                      {r.is_instructor ? 'You (Instructor)' : r.sender_name}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                    </span>
                  </div>
                  <p className="text-[var(--color-text-primary)] whitespace-pre-wrap">{r.content}</p>
                </div>
              ))
            )}
            <div ref={replyEndRef} />
          </div>

          {/* Reply input */}
          <div className="p-4 border-t border-[var(--color-border-light)] flex gap-3">
            <textarea
              className="input-glass flex-1 min-h-[60px] resize-y"
              placeholder="Write your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); sendReply(); } }}
            />
            <button onClick={sendReply} disabled={replying || !replyText.trim()} className="btn-primary px-4 self-end flex items-center gap-2 shrink-0">
              {replying ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Reply
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="animate-fade-in pb-20">
      <button onClick={() => router.push('/dashboard/academy')} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Academy
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle size={20} className="text-violet-500" />
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-[var(--color-text-muted)]">Q&A</span>
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Q&A Inbox</h1>
          {unansweredCount > 0 && (
            <p className="text-sm text-violet-600 font-semibold mt-1">{unansweredCount} unanswered</p>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {(['unanswered', 'answered', 'all'] as const).map((f) => (
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
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mx-auto mb-4 animate-float">
            <CheckCircle2 size={32} className="text-violet-500" />
          </div>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">
            {filter === 'unanswered' ? 'All questions answered!' : 'No questions yet'}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            {filter === 'unanswered' ? 'No pending questions to answer' : 'Student questions will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => {
            const hasReplies = (q.reply_count || 0) > 0;
            return (
              <div
                key={q.id}
                onClick={() => openQuestion(q)}
                className="glass-card p-5 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${hasReplies ? 'bg-gradient-to-br from-emerald-400 to-green-500' : 'bg-gradient-to-br from-violet-400 to-purple-500'}`}>
                  {q.sender_name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{q.sender_name}</p>
                    {!hasReplies && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700">New</span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 line-clamp-1">{q.content}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {q.course_title} → {q.lesson_title}
                    {hasReplies && <span className="ml-2 text-emerald-600 font-semibold">· {q.reply_count} {q.reply_count === 1 ? 'reply' : 'replies'}</span>}
                  </p>
                </div>
                <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                  {q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}
                </span>
                <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
