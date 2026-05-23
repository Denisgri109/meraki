'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import {
  ArrowLeft, Plus, Edit3, Trash2, Save, X, Loader2, GripVertical,
  GraduationCap, BookOpen, Play, FileText, CheckCircle2, Clock,
  Users, ChevronDown, ChevronRight, BarChart3, Eye, AlertTriangle,
  Video, Link2, Upload,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Course {
  id: string; title: string; description: string | null; price: number | null;
  thumbnail_url: string | null; instructor_id: string | null;
  is_published: boolean | null; created_at: string | null;
}
interface Chapter {
  id: string; course_id: string | null; title: string; order_index: number | null; created_at: string | null;
}
interface Lesson {
  id: string; course_id: string; chapter_id: string | null; title: string;
  description: string | null; video_url: string | null; video_provider: string | null;
  resource_url: string | null; has_homework: boolean | null;
  duration_minutes: number | null; order_index: number | null;
}
interface StudentRow {
  id: string; student_id: string; course_id: string; progress: number | null;
  enrolled_at: string | null; completed_at: string | null;
  profile?: { full_name: string | null; email: string | null; avatar_url: string | null };
  completed_lessons?: number; total_lessons?: number;
}

type OwnerTab = 'curriculum' | 'students' | 'analytics';

// ─── Page ───────────────────────────────────────────────────────────────────
export default function CourseEditorPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const { user, role } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  // If client visits this page, redirect to learn page
  useEffect(() => {
    if (role && role !== 'owner') {
      router.replace(`/dashboard/academy/learn/${courseId}`);
    }
  }, [role, courseId, router]);

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<OwnerTab>('curriculum');

  // Curriculum
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  // Chapter modal
  const [chapterModal, setChapterModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterSaving, setChapterSaving] = useState(false);

  // Lesson modal
  const [lessonModal, setLessonModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonParentChapter, setLessonParentChapter] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({
    title: '', description: '', video_url: '', video_provider: 'url',
    resource_url: '', has_homework: false, duration_minutes: '',
  });
  const [lessonSaving, setLessonSaving] = useState(false);

  // Delete
  const [deleteItem, setDeleteItem] = useState<{ type: 'chapter' | 'lesson'; id: string; title: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Students
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [studentLessons, setStudentLessons] = useState<{ lesson_id: string; title: string; completed: boolean }[]>([]);

  // Course edit
  const [editCourse, setEditCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: '', description: '', price: '', thumbnail_url: '' });
  const [courseSaving, setCourseSaving] = useState(false);

  // ── Fetch ──
  const fetchCourse = useCallback(async () => {
    if (!user || !courseId) return;
    try {
      const { data } = await supabase.from('courses').select('*').eq('id', courseId).single();
      if (!data) { router.replace('/dashboard/academy'); return; }
      if (data.instructor_id !== user.id) { router.replace('/dashboard/academy'); return; }
      setCourse(data as Course);
      setCourseForm({
        title: data.title, description: data.description || '',
        price: data.price?.toString() || '', thumbnail_url: data.thumbnail_url || '',
      });
    } catch { router.replace('/dashboard/academy'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, user?.id]);

  const fetchCurriculum = useCallback(async () => {
    if (!courseId) return;
    const [chapRes, lesRes] = await Promise.all([
      supabase.from('chapters').select('*').eq('course_id', courseId).order('order_index'),
      supabase.from('lessons').select('*').eq('course_id', courseId).order('order_index'),
    ]);
    setChapters((chapRes.data || []) as Chapter[]);
    setLessons((lesRes.data || []) as Lesson[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const fetchStudents = useCallback(async () => {
    if (!courseId) return;
    setStudentsLoading(true);
    try {
      const { data } = await supabase
        .from('course_enrollments')
        .select('*, profile:profiles!course_enrollments_student_id_fkey(full_name, email, avatar_url)')
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false });

      const lessonIds = lessons.map((l) => l.id);
      const enriched: StudentRow[] = [];
      for (const row of (data || []) as any[]) {
        let completedLessons = 0;
        if (lessonIds.length > 0 && row.student_id) {
          const { count } = await supabase
            .from('lesson_progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', row.student_id)
            .not('completed_at', 'is', null)
            .in('lesson_id', lessonIds);
          completedLessons = count || 0;
        }
        enriched.push({
          ...row,
          completed_lessons: completedLessons,
          total_lessons: lessonIds.length,
        });
      }
      setStudents(enriched);
    } catch (err) { console.error('[Academy] students:', err); }
    finally { setStudentsLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessons.length]);

  useEffect(() => {
    const load = async () => {
      await fetchCourse();
      await fetchCurriculum();
      setLoading(false);
    };
    load();
  }, [fetchCourse, fetchCurriculum]);

  useEffect(() => { if (tab === 'students') fetchStudents(); }, [tab, fetchStudents]);

  // ── Chapter handlers ──
  const openAddChapter = () => { setEditingChapter(null); setChapterTitle(''); setChapterModal(true); };
  const openEditChapter = (ch: Chapter) => { setEditingChapter(ch); setChapterTitle(ch.title); setChapterModal(true); };

  const saveChapter = async () => {
    if (!chapterTitle.trim()) { showToast('Title required', 'error'); return; }
    setChapterSaving(true);
    try {
      if (editingChapter) {
        const { error } = await supabase.from('chapters').update({ title: chapterTitle.trim() }).eq('id', editingChapter.id);
        if (error) throw error;
        showToast('Chapter updated', 'success');
      } else {
        const maxOrder = chapters.reduce((max, c) => Math.max(max, c.order_index || 0), 0);
        const { error } = await supabase.from('chapters').insert({
          course_id: courseId, title: chapterTitle.trim(), order_index: maxOrder + 1,
        });
        if (error) throw error;
        showToast('Chapter added', 'success');
      }
      setChapterModal(false);
      fetchCurriculum();
    } catch (err: any) { showToast(err.message || 'Failed', 'error'); }
    finally { setChapterSaving(false); }
  };

  // ── Lesson handlers ──
  const openAddLesson = (chapterId: string | null) => {
    setEditingLesson(null);
    setLessonParentChapter(chapterId);
    setLessonForm({ title: '', description: '', video_url: '', video_provider: 'url', resource_url: '', has_homework: false, duration_minutes: '' });
    setLessonModal(true);
  };

  const openEditLesson = (l: Lesson) => {
    setEditingLesson(l);
    setLessonParentChapter(l.chapter_id);
    setLessonForm({
      title: l.title, description: l.description || '', video_url: l.video_url || '',
      video_provider: l.video_provider || 'url', resource_url: l.resource_url || '',
      has_homework: l.has_homework || false, duration_minutes: l.duration_minutes?.toString() || '',
    });
    setLessonModal(true);
  };

  const saveLesson = async () => {
    if (!lessonForm.title.trim()) { showToast('Title required', 'error'); return; }
    setLessonSaving(true);
    try {
      const payload = {
        course_id: courseId,
        chapter_id: lessonParentChapter || null,
        title: lessonForm.title.trim(),
        description: lessonForm.description.trim() || null,
        video_url: lessonForm.video_url.trim() || null,
        video_provider: lessonForm.video_provider || null,
        resource_url: lessonForm.resource_url.trim() || null,
        has_homework: lessonForm.has_homework,
        duration_minutes: lessonForm.duration_minutes ? parseInt(lessonForm.duration_minutes) : null,
      };
      if (editingLesson) {
        const { error } = await supabase.from('lessons').update(payload).eq('id', editingLesson.id);
        if (error) throw error;
        showToast('Lesson updated', 'success');
      } else {
        const chapterLessons = lessons.filter((l) => l.chapter_id === lessonParentChapter);
        const maxOrder = chapterLessons.reduce((max, l) => Math.max(max, l.order_index || 0), 0);
        const { error } = await supabase.from('lessons').insert({ ...payload, order_index: maxOrder + 1 });
        if (error) throw error;
        showToast('Lesson added', 'success');
      }
      setLessonModal(false);
      fetchCurriculum();
    } catch (err: any) { showToast(err.message || 'Failed', 'error'); }
    finally { setLessonSaving(false); }
  };

  // ── Delete handler ──
  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleteLoading(true);
    try {
      const table = deleteItem.type === 'chapter' ? 'chapters' : 'lessons';
      const { error } = await supabase.from(table).delete().eq('id', deleteItem.id);
      if (error) throw error;
      showToast(`${deleteItem.type === 'chapter' ? 'Chapter' : 'Lesson'} deleted`, 'success');
      setDeleteItem(null);
      fetchCurriculum();
    } catch (err: any) { showToast(err.message || 'Failed', 'error'); }
    finally { setDeleteLoading(false); }
  };

  // ── Reorder ──
  const moveLesson = async (lessonId: string, direction: 'up' | 'down') => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    const siblings = lessons.filter((l) => l.chapter_id === lesson.chapter_id).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    const idx = siblings.findIndex((l) => l.id === lessonId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const swapLesson = siblings[swapIdx];
    await Promise.all([
      supabase.from('lessons').update({ order_index: swapLesson.order_index }).eq('id', lesson.id),
      supabase.from('lessons').update({ order_index: lesson.order_index }).eq('id', swapLesson.id),
    ]);
    fetchCurriculum();
  };

  // ── Course save ──
  const saveCourseDetails = async () => {
    if (!courseForm.title.trim()) { showToast('Title required', 'error'); return; }
    setCourseSaving(true);
    try {
      const { error } = await supabase.from('courses').update({
        title: courseForm.title.trim(),
        description: courseForm.description.trim() || null,
        price: courseForm.price ? parseFloat(courseForm.price) : 0,
        thumbnail_url: courseForm.thumbnail_url.trim() || null,
      }).eq('id', courseId);
      if (error) throw error;
      showToast('Course updated', 'success');
      setEditCourse(false);
      fetchCourse();
    } catch (err: any) { showToast(err.message || 'Failed', 'error'); }
    finally { setCourseSaving(false); }
  };

  // ── Student detail ──
  const openStudentDetail = async (s: StudentRow) => {
    setSelectedStudent(s);
    const allLessons = lessons.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    const { data: progressData } = await supabase
      .from('lesson_progress')
      .select('lesson_id, completed_at')
      .eq('user_id', s.student_id);
    const completedMap = new Map((progressData || []).map((p: any) => [p.lesson_id, !!p.completed_at]));
    setStudentLessons(allLessons.map((l) => ({
      lesson_id: l.id, title: l.title, completed: completedMap.get(l.id) || false,
    })));
  };

  if (loading || !course) {
    return (
      <div className="animate-fade-in pb-20">
        <div className="shimmer h-8 w-48 rounded mb-4" />
        <div className="shimmer h-6 w-96 rounded mb-8" />
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="shimmer h-16 rounded-xl" />)}</div>
      </div>
    );
  }

  const uncategorizedLessons = lessons.filter((l) => !l.chapter_id).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  // ── Analytics data ──
  const totalStudents = students.length;
  const completedStudents = students.filter((s) => s.completed_at).length;
  const avgProgress = totalStudents > 0
    ? Math.round(students.reduce((sum, s) => sum + ((s.completed_lessons || 0) / Math.max(s.total_lessons || 1, 1)) * 100, 0) / totalStudents)
    : 0;

  return (
    <div className="animate-fade-in pb-20">
      {/* Header */}
      <button onClick={() => router.push('/dashboard/academy')} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Academy
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div className="flex-1 min-w-0">
          {editCourse ? (
            <div className="space-y-3 max-w-xl">
              <input className="input-glass w-full text-xl font-bold" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
              <textarea className="input-glass w-full min-h-[80px] resize-y text-sm" value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} />
              <div className="flex gap-3">
                <input className="input-glass w-32" type="number" placeholder="Price" value={courseForm.price} onChange={(e) => setCourseForm({ ...courseForm, price: e.target.value })} />
                <input className="input-glass flex-1" placeholder="Thumbnail URL" value={courseForm.thumbnail_url} onChange={(e) => setCourseForm({ ...courseForm, thumbnail_url: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button onClick={saveCourseDetails} disabled={courseSaving} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
                  {courseSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                </button>
                <button onClick={() => setEditCourse(false)} className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] truncate">{course.title}</h1>
                <button onClick={() => setEditCourse(true)} className="shrink-0 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-[var(--color-text-muted)]">
                  <Edit3 size={16} />
                </button>
              </div>
              {course.description && <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-2xl">{course.description}</p>}
              <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
                <span>£{(course.price || 0).toFixed(2)}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${course.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {course.is_published ? 'Published' : 'Draft'}
                </span>
                <span>{chapters.length} chapters · {lessons.length} lessons</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-8">
        {(['curriculum', 'students', 'analytics'] as OwnerTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${tab === t ? 'bg-white shadow text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════ CURRICULUM TAB ══════════════ */}
      {tab === 'curriculum' && (
        <div className="space-y-6">
          {/* Add chapter + uncategorized lesson buttons */}
          <div className="flex gap-3">
            <button onClick={openAddChapter} className="text-sm font-semibold px-4 py-2 rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors flex items-center gap-2">
              <Plus size={14} /> Add Chapter
            </button>
            <button onClick={() => openAddLesson(null)} className="text-sm font-semibold px-4 py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2">
              <Plus size={14} /> Add Lesson
            </button>
          </div>

          {/* Chapters */}
          {chapters.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).map((chapter) => {
            const chLessons = lessons.filter((l) => l.chapter_id === chapter.id).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            const isExpanded = expandedChapter === chapter.id;
            return (
              <div key={chapter.id} className="glass-card overflow-hidden">
                <button
                  onClick={() => setExpandedChapter(isExpanded ? null : chapter.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50/50 transition-colors text-left"
                >
                  <GripVertical size={16} className="text-[var(--color-text-muted)] shrink-0" />
                  <ChevronRight size={16} className={`text-[var(--color-text-muted)] shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[var(--color-text-primary)] truncate">{chapter.title}</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">{chLessons.length} lesson{chLessons.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEditChapter(chapter)} className="w-7 h-7 rounded-md hover:bg-gray-100 flex items-center justify-center text-[var(--color-text-muted)]"><Edit3 size={13} /></button>
                    <button onClick={() => openAddLesson(chapter.id)} className="w-7 h-7 rounded-md hover:bg-cyan-50 flex items-center justify-center text-cyan-600"><Plus size={13} /></button>
                    <button onClick={() => setDeleteItem({ type: 'chapter', id: chapter.id, title: chapter.title })} className="w-7 h-7 rounded-md hover:bg-red-50 flex items-center justify-center text-red-500"><Trash2 size={13} /></button>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[var(--color-border-light)]">
                    {chLessons.length === 0 ? (
                      <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">No lessons yet</div>
                    ) : (
                      chLessons.map((lesson, idx) => (
                        <div key={lesson.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-light)] last:border-b-0 hover:bg-gray-50/30 transition-colors">
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button disabled={idx === 0} onClick={() => moveLesson(lesson.id, 'up')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30">▲</button>
                            <button disabled={idx === chLessons.length - 1} onClick={() => moveLesson(lesson.id, 'down')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30">▼</button>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
                            {lesson.video_url ? <Video size={14} className="text-cyan-600" /> : <FileText size={14} className="text-cyan-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{lesson.title}</p>
                            <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                              {lesson.duration_minutes && <span>{lesson.duration_minutes} min</span>}
                              {lesson.has_homework && <span className="text-amber-600 font-semibold">Homework</span>}
                              {lesson.resource_url && <span className="flex items-center gap-1"><Link2 size={10} />Resource</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => openEditLesson(lesson)} className="w-7 h-7 rounded-md hover:bg-gray-100 flex items-center justify-center text-[var(--color-text-muted)]"><Edit3 size={13} /></button>
                            <button onClick={() => setDeleteItem({ type: 'lesson', id: lesson.id, title: lesson.title })} className="w-7 h-7 rounded-md hover:bg-red-50 flex items-center justify-center text-red-500"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Uncategorized lessons */}
          {uncategorizedLessons.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-[var(--color-border-light)]">
                <h3 className="font-bold text-[var(--color-text-primary)]">Uncategorized Lessons</h3>
              </div>
              {uncategorizedLessons.map((lesson, idx) => (
                <div key={lesson.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-light)] last:border-b-0 hover:bg-gray-50/30 transition-colors">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button disabled={idx === 0} onClick={() => moveLesson(lesson.id, 'up')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30">▲</button>
                    <button disabled={idx === uncategorizedLessons.length - 1} onClick={() => moveLesson(lesson.id, 'down')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30">▼</button>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
                    {lesson.video_url ? <Video size={14} className="text-cyan-600" /> : <FileText size={14} className="text-cyan-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{lesson.title}</p>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                      {lesson.duration_minutes && <span>{lesson.duration_minutes} min</span>}
                      {lesson.has_homework && <span className="text-amber-600 font-semibold">Homework</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditLesson(lesson)} className="w-7 h-7 rounded-md hover:bg-gray-100 flex items-center justify-center text-[var(--color-text-muted)]"><Edit3 size={13} /></button>
                    <button onClick={() => setDeleteItem({ type: 'lesson', id: lesson.id, title: lesson.title })} className="w-7 h-7 rounded-md hover:bg-red-50 flex items-center justify-center text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {chapters.length === 0 && uncategorizedLessons.length === 0 && (
            <div className="glass-card p-16 text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center mx-auto mb-4 animate-float"><BookOpen size={32} className="text-cyan-500" /></div>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">Build your curriculum</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">Add chapters and lessons to structure your course content</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ STUDENTS TAB ══════════════ */}
      {tab === 'students' && (
        selectedStudent ? (
          <div className="space-y-6">
            <button onClick={() => setSelectedStudent(null)} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
              <ArrowLeft size={16} /> Back to Students
            </button>
            <div className="glass-card p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xl font-bold">
                  {selectedStudent.profile?.full_name?.charAt(0) || '?'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{selectedStudent.profile?.full_name || 'Unknown'}</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">{selectedStudent.profile?.email}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">Enrolled {selectedStudent.enrolled_at ? new Date(selectedStudent.enrolled_at).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" style={{ width: `${(selectedStudent.total_lessons || 0) > 0 ? Math.round(((selectedStudent.completed_lessons || 0) / (selectedStudent.total_lessons || 1)) * 100) : 0}%` }} />
                </div>
                <span className="text-sm font-bold text-[var(--color-text-secondary)]">{selectedStudent.completed_lessons || 0}/{selectedStudent.total_lessons || 0}</span>
              </div>
              {/* Lesson progress list */}
              <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Lesson Progress</h3>
              <div className="space-y-2">
                {studentLessons.map((sl) => (
                  <div key={sl.lesson_id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/50">
                    {sl.completed ? (
                      <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300 shrink-0" />
                    )}
                    <span className={`text-sm ${sl.completed ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>{sl.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : studentsLoading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="shimmer h-16 rounded-xl" />)}</div>
        ) : students.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center mx-auto mb-4 animate-float"><Users size={32} className="text-cyan-500" /></div>
            <p className="text-lg font-bold text-[var(--color-text-primary)]">No students yet</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-2">Students will appear here once they enroll</p>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((s) => {
              const pct = (s.total_lessons || 0) > 0 ? Math.round(((s.completed_lessons || 0) / (s.total_lessons || 1)) * 100) : 0;
              return (
                <div key={s.id} onClick={() => openStudentDetail(s)} className="glass-card p-4 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {s.profile?.full_name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{s.profile?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{s.profile?.email}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-[var(--color-text-secondary)] w-10 text-right">{pct}%</span>
                  </div>
                  <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ══════════════ ANALYTICS TAB ══════════════ */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-card p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Students</p>
              <p className="text-3xl font-bold text-[var(--color-text-primary)]">{totalStudents}</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Completed</p>
              <p className="text-3xl font-bold text-emerald-600">{completedStudents}</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Avg Progress</p>
              <p className="text-3xl font-bold text-cyan-600">{avgProgress}%</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Lessons</p>
              <p className="text-3xl font-bold text-[var(--color-text-primary)]">{lessons.length}</p>
            </div>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Recent Enrollments</h3>
            {students.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No enrollments yet</p>
            ) : (
              <div className="space-y-3">
                {students.slice(0, 10).map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/50">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {s.profile?.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{s.profile?.full_name || 'Unknown'}</p>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">{s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString() : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Chapter Modal ── */}
      {chapterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setChapterModal(false)}>
          <div className="glass-card w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{editingChapter ? 'Edit Chapter' : 'New Chapter'}</h2>
              <button onClick={() => setChapterModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><X size={18} /></button>
            </div>
            <input className="input-glass w-full mb-4" placeholder="Chapter title" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setChapterModal(false)} className="flex-1 px-4 py-2.5 rounded-xl font-semibold bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={saveChapter} disabled={chapterSaving} className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2">
                {chapterSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lesson Modal ── */}
      {lessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto" onClick={() => setLessonModal(false)}>
          <div className="glass-card w-full max-w-lg p-6 shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{editingLesson ? 'Edit Lesson' : 'New Lesson'}</h2>
              <button onClick={() => setLessonModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 block">Title *</label>
                <input className="input-glass w-full" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 block">Description</label>
                <textarea className="input-glass w-full min-h-[80px] resize-y" value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 block">Video URL</label>
                <input className="input-glass w-full" placeholder="https://youtube.com/... or direct URL" value={lessonForm.video_url} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 block">Duration (min)</label>
                  <input className="input-glass w-full" type="number" min="0" value={lessonForm.duration_minutes} onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 block">Resource URL</label>
                  <input className="input-glass w-full" placeholder="PDF, doc link..." value={lessonForm.resource_url} onChange={(e) => setLessonForm({ ...lessonForm, resource_url: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setLessonForm({ ...lessonForm, has_homework: !lessonForm.has_homework })}
                  className={`w-10 h-6 rounded-full transition-colors relative ${lessonForm.has_homework ? 'bg-amber-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${lessonForm.has_homework ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Requires homework submission</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setLessonModal(false)} className="flex-1 px-4 py-2.5 rounded-xl font-semibold bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={saveLesson} disabled={lessonSaving} className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2">
                {lessonSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setDeleteItem(null)}>
          <div className="glass-card w-full max-w-sm p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4"><AlertTriangle size={28} className="text-red-500" /></div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">Delete {deleteItem.type}?</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">&ldquo;{deleteItem.title}&rdquo; will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteItem(null)} className="flex-1 px-4 py-2.5 rounded-xl font-semibold bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 px-4 py-2.5 rounded-xl font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
                {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
