'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import {
  GraduationCap, Play, Search, Users, ArrowLeft, CheckCircle2, Clock, BookOpen,
  ShieldCheck, Plus, Edit3, Trash2, Eye, EyeOff, BarChart3, Inbox, MessageCircle,
  ChevronRight, Loader2, X, Save, DollarSign, FileText, AlertTriangle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Course {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  thumbnail_url: string | null;
  instructor_id: string | null;
  is_published: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  enrollment_count?: number;
  lesson_count?: number;
}

interface Enrollment {
  id: string;
  course_id: string | null;
  student_id: string | null;
  progress: number | null;
  enrolled_at: string | null;
  completed_at: string | null;
  course?: Course;
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function AcademyPage() {
  const { role } = useAuth();
  const isOwner = role === 'owner';
  return isOwner ? <OwnerAcademyView /> : <ClientAcademyView />;
}

// ═══════════════════════════════════════════════════════════════════════════
// OWNER VIEW
// ═══════════════════════════════════════════════════════════════════════════
function OwnerAcademyView() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ totalEnrollments: 0, totalRevenue: 0, pendingHomework: 0, pendingQA: 0 });

  // Create / Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form, setForm] = useState({ title: '', description: '', price: '', thumbnail_url: '', is_published: false });
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*, course_enrollments(count), lessons(count)')
        .eq('instructor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) { console.error('[Academy] courses:', error); return; }

      const mapped = (data || []).map((c: any) => ({
        ...c,
        enrollment_count: c.course_enrollments?.[0]?.count || 0,
        lesson_count: c.lessons?.[0]?.count || 0,
      }));
      setCourses(mapped as Course[]);

      // Stats
      let totalEnrollments = 0;
      mapped.forEach((c: any) => { totalEnrollments += c.enrollment_count || 0; });

      const { count: hwCount } = await supabase
        .from('homework_submissions')
        .select('*, lessons!inner(course_id, courses!inner(instructor_id))', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('lessons.courses.instructor_id', user.id);

      const { count: qaCount } = await supabase
        .from('lesson_qa_messages')
        .select('*, courses!inner(instructor_id)', { count: 'exact', head: true })
        .eq('is_question', true)
        .eq('courses.instructor_id', user.id)
        .is('parent_message_id', null);

      setStats({
        totalEnrollments,
        totalRevenue: 0,
        pendingHomework: hwCount || 0,
        pendingQA: qaCount || 0,
      });
    } catch (err) {
      console.error('[Academy] fetch error:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const filtered = courses.filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => {
    setEditingCourse(null);
    setForm({ title: '', description: '', price: '', thumbnail_url: '', is_published: false });
    setShowModal(true);
  };

  const openEdit = (c: Course) => {
    setEditingCourse(c);
    setForm({
      title: c.title,
      description: c.description || '',
      price: c.price?.toString() || '',
      thumbnail_url: c.thumbnail_url || '',
      is_published: c.is_published || false,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!user || !form.title.trim()) { showToast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        price: form.price ? parseFloat(form.price) : 0,
        thumbnail_url: form.thumbnail_url.trim() || null,
        is_published: form.is_published,
        instructor_id: user.id,
      };

      if (editingCourse) {
        const { error } = await supabase.from('courses').update(payload).eq('id', editingCourse.id);
        if (error) throw error;
        showToast('Course updated', 'success');
      } else {
        const { error } = await supabase.from('courses').insert(payload);
        if (error) throw error;
        showToast('Course created', 'success');
      }
      setShowModal(false);
      fetchCourses();
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('courses').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      showToast('Course deleted', 'success');
      setDeleteTarget(null);
      fetchCourses();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const togglePublish = async (c: Course) => {
    const next = !c.is_published;
    const { error } = await supabase.from('courses').update({ is_published: next }).eq('id', c.id);
    if (error) { showToast('Failed to update', 'error'); return; }
    showToast(next ? 'Course published' : 'Course unpublished', 'success');
    fetchCourses();
  };

  return (
    <div className="animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap size={20} className="text-cyan-500" />
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-[var(--color-text-muted)]">Academy</span>
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Course Management</h1>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-5 py-2.5 shrink-0">
          <Plus size={18} /> New Course
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Courses" value={courses.length} accent="from-cyan-400 to-blue-400" />
        <StatCard label="Enrollments" value={stats.totalEnrollments} accent="from-pink-400 to-rose-400" />
        <button onClick={() => router.push('/dashboard/academy/homework')} className="text-left glass-card p-4 hover:shadow-md transition-all relative">
          <div className="w-2 h-2 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 mb-3" />
          <p className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">{stats.pendingHomework}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mt-1">Homework</p>
          {stats.pendingHomework > 0 && (
            <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>
        <button onClick={() => router.push('/dashboard/academy/qa')} className="text-left glass-card p-4 hover:shadow-md transition-all relative">
          <div className="w-2 h-2 rounded-full bg-gradient-to-br from-violet-400 to-purple-400 mb-3" />
          <p className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">{stats.pendingQA}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mt-1">Q&A</p>
          {stats.pendingQA > 0 && (
            <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
        <input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-glass w-full pl-11"
        />
      </div>

      {/* Courses Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card overflow-hidden">
              <div className="aspect-video shimmer" />
              <div className="p-5 space-y-2">
                <div className="shimmer h-4 rounded w-3/4" />
                <div className="shimmer h-3 rounded w-full" />
                <div className="shimmer h-3 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center mx-auto mb-4 animate-float">
            <GraduationCap size={32} className="text-cyan-500" />
          </div>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">{search ? 'No matching courses' : 'No courses yet'}</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">{search ? 'Try a different search' : 'Create your first course to get started'}</p>
          {!search && (
            <button onClick={openCreate} className="btn-primary mt-6 px-6 py-2.5 inline-flex items-center gap-2">
              <Plus size={16} /> Create Course
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((course) => (
            <div key={course.id} className="glass-card overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              {/* Thumbnail */}
              <div
                className="aspect-video relative cursor-pointer overflow-hidden"
                onClick={() => router.push(`/dashboard/academy/${course.id}`)}
                style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(6,182,212,0.1))' }}
              >
                {course.thumbnail_url ? (
                  <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg">
                      <Play size={28} className="text-white ml-1" />
                    </div>
                  </div>
                )}
                {/* Published badge */}
                <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${course.is_published ? 'bg-emerald-500 text-white' : 'bg-gray-800/70 text-gray-300'}`}>
                  {course.is_published ? 'Published' : 'Draft'}
                </span>
              </div>

              <div className="p-5">
                <h3
                  className="font-bold text-[var(--color-text-primary)] truncate cursor-pointer hover:text-cyan-600 transition-colors"
                  onClick={() => router.push(`/dashboard/academy/${course.id}`)}
                >
                  {course.title}
                </h3>
                {course.description && (
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">{course.description}</p>
                )}

                <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1"><Users size={12} />{course.enrollment_count || 0}</span>
                  <span className="flex items-center gap-1"><BookOpen size={12} />{course.lesson_count || 0} lessons</span>
                  <span className="flex items-center gap-1"><DollarSign size={12} />£{(course.price || 0).toFixed(2)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--color-border-light)]">
                  <button
                    onClick={() => router.push(`/dashboard/academy/${course.id}`)}
                    className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors flex items-center justify-center gap-1"
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => togglePublish(course)}
                    className="text-xs font-semibold px-3 py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1"
                  >
                    {course.is_published ? <EyeOff size={13} /> : <Eye size={13} />}
                    {course.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(course)}
                    className="text-xs px-2 py-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ──────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="glass-card w-full max-w-lg p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{editingCourse ? 'Edit Course' : 'New Course'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 block">Title *</label>
                <input className="input-glass w-full" placeholder="e.g. Advanced Nail Art Masterclass" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 block">Description</label>
                <textarea className="input-glass w-full min-h-[100px] resize-y" placeholder="Describe what students will learn..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 block">Price (£)</label>
                  <input className="input-glass w-full" type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 block">Thumbnail URL</label>
                  <input className="input-glass w-full" placeholder="https://..." value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_published: !form.is_published })}
                  className={`w-10 h-6 rounded-full transition-colors relative ${form.is_published ? 'bg-emerald-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_published ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Publish immediately</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl font-semibold bg-gray-100 hover:bg-gray-200 text-[var(--color-text-primary)] transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingCourse ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ──────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setDeleteTarget(null)}>
          <div className="glass-card w-full max-w-sm p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">Delete Course?</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              &ldquo;{deleteTarget.title}&rdquo; and all its chapters, lessons, and enrollment data will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 rounded-xl font-semibold bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="glass-card p-4 hover:shadow-md transition-all">
      <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${accent} mb-3`} />
      <p className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mt-1">{label}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT VIEW
// ═══════════════════════════════════════════════════════════════════════════
function ClientAcademyView() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'browse' | 'my-courses'>('browse');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Browse
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());

  // My Courses
  const [myEnrollments, setMyEnrollments] = useState<(Enrollment & { course: Course })[]>([]);
  const [myLoading, setMyLoading] = useState(false);

  const fetchBrowse = useCallback(async () => {
    try {
      const [coursesRes, enrollmentsRes] = await Promise.all([
        supabase
          .from('courses')
          .select('*, course_enrollments(count), lessons(count)')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(30),
        user
          ? supabase.from('course_enrollments').select('course_id').eq('student_id', user.id)
          : Promise.resolve({ data: [] }),
      ]);

      const mapped = (coursesRes.data || []).map((c: any) => ({
        ...c,
        enrollment_count: c.course_enrollments?.[0]?.count || 0,
        lesson_count: c.lessons?.[0]?.count || 0,
      }));
      setCourses(mapped as Course[]);

      const ids = new Set<string>();
      ((enrollmentsRes as any).data || []).forEach((e: any) => { if (e.course_id) ids.add(e.course_id); });
      setEnrolledIds(ids);
    } catch (err) {
      console.error('[Academy] browse error:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchMyCourses = useCallback(async () => {
    if (!user) return;
    setMyLoading(true);
    try {
      const { data } = await supabase
        .from('course_enrollments')
        .select('*, course:courses(*)')
        .eq('student_id', user.id)
        .order('enrolled_at', { ascending: false });

      const enriched: (Enrollment & { course: Course })[] = [];
      for (const row of (data || []) as any[]) {
        if (!row.course) continue;
        // Get lesson + progress counts for this course
        const { count: lessonCount } = await supabase
          .from('lessons')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', row.course.id);
        const { count: completedCount } = await supabase
          .from('lesson_progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .not('completed_at', 'is', null)
          .in('lesson_id', (await supabase.from('lessons').select('id').eq('course_id', row.course.id)).data?.map((l: any) => l.id) || []);

        const totalLessons = lessonCount || 0;
        const completed = completedCount || 0;
        const progress = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

        enriched.push({
          ...row,
          progress,
          course: { ...row.course, lesson_count: totalLessons },
        });
      }
      setMyEnrollments(enriched);
    } catch (err) {
      console.error('[Academy] my courses error:', err);
    } finally {
      setMyLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => { fetchBrowse(); }, [fetchBrowse]);
  useEffect(() => { if (tab === 'my-courses') fetchMyCourses(); }, [tab, fetchMyCourses]);

  const filtered = courses.filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()));

  const handleEnroll = async () => {
    if (!user || !selectedCourse) return;
    setEnrolling(true);
    try {
      const { error } = await supabase.from('course_enrollments').insert({
        student_id: user.id,
        course_id: selectedCourse.id,
      });
      if (error) {
        if (error.code === '23505') { showToast('Already enrolled in this course', 'info'); setEnrolling(false); return; }
        throw error;
      }
      setIsSuccess(true);
      setEnrolledIds((prev) => new Set(prev).add(selectedCourse.id));
    } catch (err: any) {
      showToast(err.message || 'Enrollment failed', 'error');
    } finally {
      setEnrolling(false);
    }
  };

  // ── Success view ──
  if (isSuccess && selectedCourse) {
    return (
      <div className="animate-fade-in max-w-lg mx-auto text-center pt-20">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-cyan-500/30 animate-bounce-gentle">
          <GraduationCap size={48} className="text-white" />
        </div>
        <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-4">Enrollment Successful!</h2>
        <p className="text-[var(--color-text-secondary)] mb-8 text-lg">
          You are now enrolled in <span className="font-bold text-[var(--color-text-primary)]">{selectedCourse.title}</span>.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={() => router.push(`/dashboard/academy/learn/${selectedCourse.id}`)} className="btn-primary px-8 py-3">Start Learning Now</button>
          <button onClick={() => { setIsSuccess(false); setSelectedCourse(null); }} className="px-8 py-3 rounded-xl font-bold bg-[var(--color-surface-light)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] transition-colors">Browse More</button>
        </div>
      </div>
    );
  }

  // ── Course detail / checkout ──
  if (selectedCourse) {
    const alreadyEnrolled = enrolledIds.has(selectedCourse.id);
    return (
      <div className="max-w-5xl mx-auto animate-fade-in pb-20">
        <button onClick={() => setSelectedCourse(null)} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Courses
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="aspect-video rounded-[var(--radius-3xl)] overflow-hidden shadow-2xl relative bg-black">
              {selectedCourse.thumbnail_url ? (
                <img src={selectedCourse.thumbnail_url} alt={selectedCourse.title} className="w-full h-full object-cover opacity-80" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-900 to-cyan-900 flex items-center justify-center"><Play size={64} className="text-white/30" /></div>
              )}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50 cursor-pointer hover:scale-110 transition-transform shadow-2xl">
                  <Play size={32} className="text-white ml-2" fill="white" />
                </div>
              </div>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-text-primary)] mb-4">{selectedCourse.title}</h1>
              <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed mb-6">
                {selectedCourse.description || 'Learn everything you need to know from the best professionals in the industry.'}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-[var(--color-border-light)]">
                <div className="flex flex-col gap-1 text-center p-3"><Clock size={24} className="text-cyan-500 mx-auto" /><span className="text-xs text-[var(--color-text-muted)] mt-2 uppercase tracking-wide font-bold">Access</span><span className="font-semibold text-[var(--color-text-primary)]">Lifetime</span></div>
                <div className="flex flex-col gap-1 text-center p-3"><Users size={24} className="text-pink-500 mx-auto" /><span className="text-xs text-[var(--color-text-muted)] mt-2 uppercase tracking-wide font-bold">Enrolled</span><span className="font-semibold text-[var(--color-text-primary)]">{selectedCourse.enrollment_count || 0} Students</span></div>
                <div className="flex flex-col gap-1 text-center p-3"><BookOpen size={24} className="text-amber-400 mx-auto" /><span className="text-xs text-[var(--color-text-muted)] mt-2 uppercase tracking-wide font-bold">Content</span><span className="font-semibold text-[var(--color-text-primary)]">{selectedCourse.lesson_count || 0} Lessons</span></div>
                <div className="flex flex-col gap-1 text-center p-3"><ShieldCheck size={24} className="text-emerald-500 mx-auto" /><span className="text-xs text-[var(--color-text-muted)] mt-2 uppercase tracking-wide font-bold">Certificate</span><span className="font-semibold text-[var(--color-text-primary)]">Included</span></div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="glass-card p-6 sticky top-24 shadow-xl border border-[var(--color-border)] shadow-cyan-500/10">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Enrollment Summary</h2>
              <div className="h-[1px] w-full bg-[var(--color-border-light)] mb-6" />
              <div className="flex justify-between items-center mb-6">
                <span className="text-[var(--color-text-secondary)] font-medium">Course Price</span>
                <span className="text-3xl font-extrabold text-gradient-pink">£{(selectedCourse.price || 0).toFixed(2)}</span>
              </div>
              <div className="space-y-4 mb-8">
                <div className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" /><span className="text-sm text-[var(--color-text-secondary)]">Lifetime access to all materials</span></div>
                <div className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" /><span className="text-sm text-[var(--color-text-secondary)]">1-on-1 mentorship sessions</span></div>
                <div className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" /><span className="text-sm text-[var(--color-text-secondary)]">Official Merakí Certification</span></div>
              </div>
              {alreadyEnrolled ? (
                <button onClick={() => router.push(`/dashboard/academy/learn/${selectedCourse.id}`)} className="w-full btn-primary py-4 text-lg font-bold" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}>
                  Continue Learning
                </button>
              ) : (
                <button onClick={handleEnroll} disabled={enrolling} className="w-full btn-primary py-4 text-lg font-bold shadow-xl shadow-blue-500/20 hover:shadow-2xl hover:-translate-y-1 transition-all" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)' }}>
                  {enrolling ? 'Processing...' : 'Enroll Now'}
                </button>
              )}
              <div className="flex items-center justify-center gap-2 mt-4 opacity-60">
                <ShieldCheck size={14} className="text-[var(--color-text-muted)]" />
                <span className="text-xs text-[var(--color-text-muted)]">Secure enrollment process</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main browse / my-courses view ──
  return (
    <div className="animate-fade-in pb-20">
      {/* Hero Banner */}
      <div className="relative rounded-[var(--radius-2xl)] overflow-hidden mb-10 h-[220px]">
        <img src="https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=1600&q=80&auto=format&fit=crop" alt="Academy" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.3), transparent)' }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white p-6">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap size={18} className="text-cyan-300" />
            <span className="text-xs tracking-[3px] uppercase text-cyan-300 font-bold">Academy</span>
          </div>
          <h1 className="text-4xl font-bold drop-shadow-md">Master Your Craft</h1>
          <p className="text-white/80 text-sm mt-2 max-w-md">Learn from industry experts and elevate your skills</p>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        <button onClick={() => setTab('browse')} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'browse' ? 'bg-white shadow text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>
          Browse Courses
        </button>
        <button onClick={() => setTab('my-courses')} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'my-courses' ? 'bg-white shadow text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>
          My Courses
        </button>
      </div>

      {tab === 'browse' ? (
        <>
          {/* Search */}
          <div className="relative mb-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
            <input type="text" placeholder="Search courses..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-glass w-full pl-11" />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-card overflow-hidden"><div className="aspect-video shimmer" /><div className="p-5 space-y-2"><div className="shimmer h-4 rounded w-3/4" /><div className="shimmer h-3 rounded w-full" /><div className="shimmer h-3 rounded w-1/3" /></div></div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-16 text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center mx-auto mb-4 animate-float"><GraduationCap size={32} className="text-cyan-500" /></div>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">No courses available yet</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">New courses are added regularly — check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((course) => {
                const enrolled = enrolledIds.has(course.id);
                return (
                  <div key={course.id} onClick={() => setSelectedCourse(course)} className="glass-card overflow-hidden hover:shadow-xl hover:border-cyan-500/30 hover:-translate-y-2 transition-all duration-300 cursor-pointer group">
                    <div className="aspect-video relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(6,182,212,0.1))' }}>
                      {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg"><Play size={28} className="text-white ml-1" /></div>
                        </div>
                      )}
                      {enrolled && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white">Enrolled</span>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-[var(--color-text-primary)] truncate group-hover:text-cyan-600 transition-colors">{course.title}</h3>
                      {course.description && <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">{course.description}</p>}
                      <div className="flex items-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]">
                        <span className="flex items-center gap-1"><Users size={12} />{course.enrollment_count || 0} enrolled</span>
                        <span className="flex items-center gap-1"><BookOpen size={12} />{course.lesson_count || 0} lessons</span>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border-light)]">
                        <span className="text-gradient-pink text-lg font-bold">£{(course.price || 0).toFixed(2)}</span>
                        <span className="text-xs text-cyan-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">View Details →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ── My Courses ── */
        myLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="shimmer h-24 rounded-xl" />)}
          </div>
        ) : myEnrollments.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center mx-auto mb-4 animate-float"><BookOpen size={32} className="text-cyan-500" /></div>
            <p className="text-lg font-bold text-[var(--color-text-primary)]">No enrolled courses yet</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-2">Browse courses and start learning today!</p>
            <button onClick={() => setTab('browse')} className="btn-primary mt-6 px-6 py-2.5 inline-flex items-center gap-2"><Search size={16} /> Browse Courses</button>
          </div>
        ) : (
          <div className="space-y-4">
            {myEnrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                onClick={() => router.push(`/dashboard/academy/learn/${enrollment.course.id}`)}
                className="glass-card p-5 flex items-center gap-5 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group"
              >
                {/* Thumbnail */}
                <div className="w-24 h-16 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-cyan-50 to-blue-50">
                  {enrollment.course.thumbnail_url ? (
                    <img src={enrollment.course.thumbnail_url} alt={enrollment.course.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><GraduationCap size={20} className="text-cyan-400" /></div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[var(--color-text-primary)] truncate group-hover:text-cyan-600 transition-colors">{enrollment.course.title}</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{enrollment.course.lesson_count || 0} lessons</p>
                  {/* Progress bar */}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" style={{ width: `${enrollment.progress || 0}%` }} />
                    </div>
                    <span className="text-xs font-bold text-[var(--color-text-secondary)] shrink-0">{enrollment.progress || 0}%</span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-[var(--color-text-muted)] shrink-0" />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
