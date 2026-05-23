'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import {
  ArrowLeft, CheckCircle2, Circle, Play, FileText, Clock, BookOpen,
  ChevronDown, ChevronRight, Send, MessageCircle, Upload, Loader2,
  GraduationCap, Link2, Download, Lock, Video, X, Image,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Course { id: string; title: string; description: string | null; thumbnail_url: string | null; instructor_id: string | null; }
interface Chapter { id: string; course_id: string | null; title: string; order_index: number | null; }
interface Lesson {
  id: string; course_id: string; chapter_id: string | null; title: string;
  description: string | null; video_url: string | null; video_provider: string | null;
  resource_url: string | null; has_homework: boolean | null;
  duration_minutes: number | null; order_index: number | null;
}
interface LessonProgress { lesson_id: string; progress_percent: number | null; completed_at: string | null; last_position_seconds: number | null; }
interface HomeworkSubmission { id: string; lesson_id: string; student_id: string; photo_url: string | null; notes: string | null; status: string | null; feedback: string | null; reviewed_at: string | null; created_at: string | null; }
interface QAMessage { id: string; lesson_id: string; course_id: string; sender_id: string; content: string; is_question: boolean; parent_message_id: string | null; created_at: string | null; sender_name?: string; }

export default function LearnCoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Map<string, LessonProgress>>(new Map());
  const [loading, setLoading] = useState(true);

  // Active lesson
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Homework
  const [hwSubmission, setHwSubmission] = useState<HomeworkSubmission | null>(null);
  const [hwForm, setHwForm] = useState({ photo_url: '', notes: '' });
  const [hwSubmitting, setHwSubmitting] = useState(false);
  const [hwTab, setHwTab] = useState<'submit' | 'feedback'>('submit');

  // Q&A
  const [qaMessages, setQaMessages] = useState<QAMessage[]>([]);
  const [qaInput, setQaInput] = useState('');
  const [qaSending, setQaSending] = useState(false);
  const [qaExpanded, setQaExpanded] = useState(false);
  const qaEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    if (!user || !courseId) return;
    try {
      // Check enrollment
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('student_id', user.id)
        .maybeSingle();

      if (!enrollment) {
        showToast('You are not enrolled in this course', 'error');
        router.replace('/dashboard/academy');
        return;
      }

      const [courseRes, chapRes, lesRes, progRes] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase.from('chapters').select('*').eq('course_id', courseId).order('order_index'),
        supabase.from('lessons').select('*').eq('course_id', courseId).order('order_index'),
        supabase.from('lesson_progress').select('*').eq('user_id', user.id),
      ]);

      setCourse(courseRes.data as Course);
      setChapters((chapRes.data || []) as Chapter[]);
      const allLessons = (lesRes.data || []) as Lesson[];
      setLessons(allLessons);

      const progMap = new Map<string, LessonProgress>();
      (progRes.data || []).forEach((p: any) => { progMap.set(p.lesson_id, p); });
      setProgress(progMap);

      // Set active lesson to first incomplete or first lesson
      if (allLessons.length > 0) {
        const firstIncomplete = allLessons.find((l) => !progMap.get(l.id)?.completed_at);
        setActiveLesson(firstIncomplete || allLessons[0]);
      }
    } catch (err) {
      console.error('[Learn] error:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Fetch lesson-specific data when active lesson changes ──
  useEffect(() => {
    if (!activeLesson || !user) return;
    // Homework submission
    if (activeLesson.has_homework) {
      supabase
        .from('homework_submissions')
        .select('*')
        .eq('lesson_id', activeLesson.id)
        .eq('student_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setHwSubmission(data as HomeworkSubmission | null);
          if (data?.status === 'reviewed') setHwTab('feedback');
          else setHwTab('submit');
        });
    } else {
      setHwSubmission(null);
    }
    // Q&A
    supabase
      .from('lesson_qa_messages')
      .select('*, sender:profiles!lesson_qa_messages_sender_id_fkey(full_name)')
      .eq('lesson_id', activeLesson.id)
      .order('created_at')
      .then(({ data }) => {
        setQaMessages((data || []).map((m: any) => ({ ...m, sender_name: m.sender?.full_name })));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLesson?.id, user?.id]);

  // ── Mark lesson complete ──
  const markComplete = async (lessonId: string) => {
    if (!user) return;
    const existing = progress.get(lessonId);
    if (existing?.completed_at) return;

    const payload = {
      lesson_id: lessonId,
      user_id: user.id,
      progress_percent: 100,
      completed_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from('lesson_progress').update(payload).eq('lesson_id', lessonId).eq('user_id', user.id);
    } else {
      await supabase.from('lesson_progress').insert(payload);
    }

    setProgress((prev) => {
      const next = new Map(prev);
      next.set(lessonId, { ...payload, last_position_seconds: null });
      return next;
    });
    showToast('Lesson completed!', 'success');
  };

  const markIncomplete = async (lessonId: string) => {
    if (!user) return;
    await supabase.from('lesson_progress').update({ completed_at: null, progress_percent: 0 }).eq('lesson_id', lessonId).eq('user_id', user.id);
    setProgress((prev) => {
      const next = new Map(prev);
      const existing = next.get(lessonId);
      if (existing) next.set(lessonId, { ...existing, completed_at: null, progress_percent: 0 });
      return next;
    });
  };

  // ── Navigate lessons ──
  const goToLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
    setQaExpanded(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextLesson = () => {
    if (!activeLesson) return;
    const idx = lessons.findIndex((l) => l.id === activeLesson.id);
    if (idx < lessons.length - 1) goToLesson(lessons[idx + 1]);
  };

  const prevLesson = () => {
    if (!activeLesson) return;
    const idx = lessons.findIndex((l) => l.id === activeLesson.id);
    if (idx > 0) goToLesson(lessons[idx - 1]);
  };

  // ── Submit homework ──
  const submitHomework = async () => {
    if (!user || !activeLesson || (!hwForm.photo_url.trim() && !hwForm.notes.trim())) {
      showToast('Add a photo URL or notes', 'error'); return;
    }
    setHwSubmitting(true);
    try {
      if (hwSubmission) {
        const { error } = await supabase.from('homework_submissions').update({
          photo_url: hwForm.photo_url.trim() || undefined,
          notes: hwForm.notes.trim() || null,
          status: 'pending',
        }).eq('id', hwSubmission.id);
        if (error) throw error;
      } else {
        const photoUrl = hwForm.photo_url.trim();
        if (!photoUrl) { showToast('Photo URL is required', 'error'); setHwSubmitting(false); return; }
        const { error } = await supabase.from('homework_submissions').insert({
          lesson_id: activeLesson.id,
          student_id: user.id,
          photo_url: photoUrl,
          notes: hwForm.notes.trim() || null,
          status: 'pending',
        });
        if (error) throw error;
      }
      showToast('Homework submitted!', 'success');
      // Refresh
      const { data } = await supabase.from('homework_submissions').select('*').eq('lesson_id', activeLesson.id).eq('student_id', user.id).maybeSingle();
      setHwSubmission(data as HomeworkSubmission | null);
    } catch (err: any) { showToast(err.message || 'Failed', 'error'); }
    finally { setHwSubmitting(false); }
  };

  // ── Send Q&A message ──
  const sendQA = async () => {
    if (!user || !activeLesson || !qaInput.trim()) return;
    setQaSending(true);
    try {
      const { error } = await supabase.from('lesson_qa_messages').insert({
        lesson_id: activeLesson.id,
        course_id: courseId,
        sender_id: user.id,
        content: qaInput.trim(),
        is_question: true,
      });
      if (error) throw error;
      setQaInput('');
      // Refresh messages
      const { data } = await supabase
        .from('lesson_qa_messages')
        .select('*, sender:profiles!lesson_qa_messages_sender_id_fkey(full_name)')
        .eq('lesson_id', activeLesson.id)
        .order('created_at');
      setQaMessages((data || []).map((m: any) => ({ ...m, sender_name: m.sender?.full_name })));
      setTimeout(() => qaEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) { showToast(err.message || 'Failed', 'error'); }
    finally { setQaSending(false); }
  };

  // ── Video embed helper ──
  const getVideoEmbed = (url: string) => {
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return null;
  };

  // ── Progress stats ──
  const completedCount = lessons.filter((l) => progress.get(l.id)?.completed_at).length;
  const progressPct = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  if (loading) {
    return (
      <div className="animate-fade-in pb-20">
        <div className="shimmer h-8 w-48 rounded mb-4" />
        <div className="shimmer h-[400px] rounded-xl mb-4" />
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="shimmer h-12 rounded-lg" />)}</div>
      </div>
    );
  }

  if (!course || !activeLesson) {
    return (
      <div className="animate-fade-in text-center pt-20">
        <GraduationCap size={48} className="text-cyan-400 mx-auto mb-4" />
        <p className="text-lg font-bold text-[var(--color-text-primary)]">Course not found</p>
        <button onClick={() => router.push('/dashboard/academy')} className="btn-primary mt-6 px-6 py-2.5">Back to Academy</button>
      </div>
    );
  }

  const lessonIdx = lessons.findIndex((l) => l.id === activeLesson.id);
  const isCompleted = !!progress.get(activeLesson.id)?.completed_at;

  return (
    <div className="animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/dashboard/academy')} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
          <ArrowLeft size={16} /> {course.title}
        </button>
        <div className="flex items-center gap-3">
          <div className="w-32 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs font-bold text-[var(--color-text-secondary)]">{completedCount}/{lessons.length}</span>
        </div>
      </div>

      <div className="flex gap-6">
        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0">
          {/* Video / Thumbnail */}
          <div className="aspect-video rounded-2xl overflow-hidden bg-black mb-6 shadow-xl">
            {activeLesson.video_url ? (
              (() => {
                const embedUrl = getVideoEmbed(activeLesson.video_url);
                if (embedUrl) {
                  return <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />;
                }
                return (
                  <video src={activeLesson.video_url} controls className="w-full h-full" />
                );
              })()
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-900 to-cyan-900 flex items-center justify-center">
                <FileText size={48} className="text-white/30" />
              </div>
            )}
          </div>

          {/* Lesson Info */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">{activeLesson.title}</h2>
                <div className="flex items-center gap-3 mt-2 text-sm text-[var(--color-text-muted)]">
                  {activeLesson.duration_minutes && <span className="flex items-center gap-1"><Clock size={14} />{activeLesson.duration_minutes} min</span>}
                  <span>Lesson {lessonIdx + 1} of {lessons.length}</span>
                </div>
              </div>
              <button
                onClick={() => isCompleted ? markIncomplete(activeLesson.id) : markComplete(activeLesson.id)}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${isCompleted ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <CheckCircle2 size={16} /> {isCompleted ? 'Completed' : 'Mark Complete'}
              </button>
            </div>
            {activeLesson.description && (
              <p className="text-[var(--color-text-secondary)] mt-4 leading-relaxed">{activeLesson.description}</p>
            )}
            {activeLesson.resource_url && (
              <a href={activeLesson.resource_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors">
                <Download size={14} /> Download Resources
              </a>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3 mb-8">
            <button onClick={prevLesson} disabled={lessonIdx === 0} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-[var(--color-text-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              ← Previous
            </button>
            <button
              onClick={() => { if (!isCompleted) markComplete(activeLesson.id); nextLesson(); }}
              disabled={lessonIdx === lessons.length - 1}
              className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {lessonIdx === lessons.length - 1 ? 'Course Complete!' : 'Next Lesson →'}
            </button>
          </div>

          {/* ── Homework Section ── */}
          {activeLesson.has_homework && (
            <div className="glass-card p-6 mb-6">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2"><Upload size={18} className="text-amber-500" /> Homework</h3>

              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
                <button onClick={() => setHwTab('submit')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${hwTab === 'submit' ? 'bg-white shadow' : 'text-[var(--color-text-muted)]'}`}>Submit</button>
                <button onClick={() => setHwTab('feedback')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${hwTab === 'feedback' ? 'bg-white shadow' : 'text-[var(--color-text-muted)]'}`}>
                  Feedback {hwSubmission?.feedback ? '✓' : ''}
                </button>
              </div>

              {hwTab === 'submit' ? (
                <div className="space-y-4">
                  {hwSubmission?.status === 'reviewed' && (
                    <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 size={16} /> Your homework has been reviewed. Check the Feedback tab.
                    </div>
                  )}
                  {hwSubmission?.status === 'pending' && (
                    <div className="p-3 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium flex items-center gap-2">
                      <Clock size={16} /> Your submission is pending review.
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 block">Photo URL</label>
                    <input
                      className="input-glass w-full"
                      placeholder="https://... (link to your photo submission)"
                      value={hwForm.photo_url || hwSubmission?.photo_url || ''}
                      onChange={(e) => setHwForm({ ...hwForm, photo_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 block">Notes</label>
                    <textarea
                      className="input-glass w-full min-h-[80px] resize-y"
                      placeholder="Any additional notes about your submission..."
                      value={hwForm.notes || hwSubmission?.notes || ''}
                      onChange={(e) => setHwForm({ ...hwForm, notes: e.target.value })}
                    />
                  </div>
                  <button onClick={submitHomework} disabled={hwSubmitting} className="btn-primary px-6 py-2.5 flex items-center gap-2">
                    {hwSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {hwSubmission ? 'Resubmit' : 'Submit'}
                  </button>
                </div>
              ) : (
                <div>
                  {hwSubmission?.feedback ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-100">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Instructor Feedback</p>
                        <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{hwSubmission.feedback}</p>
                        {hwSubmission.reviewed_at && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-3">{new Date(hwSubmission.reviewed_at).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No feedback yet. Your instructor will review your submission soon.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Q&A Section ── */}
          <div className="glass-card overflow-hidden">
            <button onClick={() => setQaExpanded(!qaExpanded)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2"><MessageCircle size={18} className="text-violet-500" /> Q&A</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)]">{qaMessages.length} messages</span>
                {qaExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
            </button>

            {qaExpanded && (
              <div className="border-t border-[var(--color-border-light)]">
                {/* Messages */}
                <div className="p-4 max-h-[400px] overflow-y-auto space-y-3">
                  {qaMessages.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] text-center py-6">No questions yet. Ask the first one!</p>
                  ) : (
                    qaMessages.map((msg) => {
                      const isOwn = msg.sender_id === user?.id;
                      const isInstructor = msg.sender_id === course.instructor_id;
                      return (
                        <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-3 rounded-xl text-sm ${isOwn ? 'bg-cyan-500 text-white' : isInstructor ? 'bg-violet-50 border border-violet-200' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-bold ${isOwn ? 'text-white/80' : isInstructor ? 'text-violet-600' : 'text-[var(--color-text-muted)]'}`}>
                                {isOwn ? 'You' : isInstructor ? 'Instructor' : msg.sender_name || 'Student'}
                              </span>
                              <span className={`text-xs ${isOwn ? 'text-white/60' : 'text-[var(--color-text-muted)]'}`}>
                                {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className={`whitespace-pre-wrap ${isOwn ? '' : 'text-[var(--color-text-primary)]'}`}>{msg.content}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={qaEndRef} />
                </div>
                {/* Input */}
                <div className="p-4 border-t border-[var(--color-border-light)] flex gap-3">
                  <input
                    className="input-glass flex-1"
                    placeholder="Ask a question..."
                    value={qaInput}
                    onChange={(e) => setQaInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQA(); } }}
                  />
                  <button onClick={sendQA} disabled={qaSending || !qaInput.trim()} className="btn-primary px-4 py-2 flex items-center gap-2 shrink-0">
                    {qaSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className={`hidden lg:block w-80 shrink-0 ${sidebarOpen ? '' : 'lg:hidden'}`}>
          <div className="glass-card sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto">
            <div className="p-4 border-b border-[var(--color-border-light)]">
              <h3 className="font-bold text-[var(--color-text-primary)] text-sm">Course Content</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{completedCount}/{lessons.length} completed</p>
              <div className="w-full h-1.5 rounded-full bg-gray-100 mt-2 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="p-2">
              {chapters.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).map((chapter) => {
                const chLessons = lessons.filter((l) => l.chapter_id === chapter.id).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
                return (
                  <div key={chapter.id} className="mb-1">
                    <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-3 py-2">{chapter.title}</p>
                    {chLessons.map((lesson) => {
                      const isActive = activeLesson?.id === lesson.id;
                      const done = !!progress.get(lesson.id)?.completed_at;
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => goToLesson(lesson)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${isActive ? 'bg-cyan-50 text-cyan-700 font-semibold' : 'hover:bg-gray-50 text-[var(--color-text-primary)]'}`}
                        >
                          {done ? (
                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          ) : isActive ? (
                            <Play size={16} className="text-cyan-500 shrink-0" />
                          ) : (
                            <Circle size={16} className="text-gray-300 shrink-0" />
                          )}
                          <span className="truncate flex-1">{lesson.title}</span>
                          {lesson.duration_minutes && <span className="text-xs text-[var(--color-text-muted)] shrink-0">{lesson.duration_minutes}m</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* Uncategorized */}
              {lessons.filter((l) => !l.chapter_id).length > 0 && (
                <div className="mb-1">
                  {chapters.length > 0 && <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-3 py-2">Other Lessons</p>}
                  {lessons.filter((l) => !l.chapter_id).sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).map((lesson) => {
                    const isActive = activeLesson?.id === lesson.id;
                    const done = !!progress.get(lesson.id)?.completed_at;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => goToLesson(lesson)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${isActive ? 'bg-cyan-50 text-cyan-700 font-semibold' : 'hover:bg-gray-50 text-[var(--color-text-primary)]'}`}
                      >
                        {done ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> : isActive ? <Play size={16} className="text-cyan-500 shrink-0" /> : <Circle size={16} className="text-gray-300 shrink-0" />}
                        <span className="truncate flex-1">{lesson.title}</span>
                        {lesson.duration_minutes && <span className="text-xs text-[var(--color-text-muted)] shrink-0">{lesson.duration_minutes}m</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
