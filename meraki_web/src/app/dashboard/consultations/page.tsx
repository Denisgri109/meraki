'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import imageCompression from 'browser-image-compression';
import {
  Camera, Upload, Clock, CheckCircle2, XCircle, MessageCircle,
  ChevronRight, Eye, Send, Star, Loader2, X, Image as ImageIcon,
  FileText, ClipboardList, ArrowLeft, AlertCircle, ThumbsUp, ThumbsDown,
  DollarSign, Timer, StickyNote, CalendarPlus
} from 'lucide-react';

// ─── Error helper ───────────────────────────────────────────────────
// Supabase PostgrestError instances stringify to "{}" in Turbopack's
// console formatter, hiding the real cause. Pull out the useful fields.
function describeError(err: unknown): { message: string; details: Record<string, unknown> } {
  if (!err) return { message: 'Unknown error', details: {} };
  if (err instanceof Error) {
    return {
      message: err.message || err.name || 'Error',
      details: {
        name: err.name,
        message: err.message,
        // PostgrestError extends Error and carries these:
        code: (err as { code?: string }).code,
        details: (err as { details?: string }).details,
        hint: (err as { hint?: string }).hint,
        stack: err.stack,
      },
    };
  }
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>;
    return {
      message: (e.message as string) || (e.error as string) || JSON.stringify(e),
      details: e,
    };
  }
  return { message: String(err), details: {} };
}

// ─── Types ──────────────────────────────────────────────────────────
interface PhotoConsultation {
  id: string;
  client_id: string;
  master_id: string | null;
  photo_url: string;
  photo_urls: string[] | null;
  client_message: string | null;
  master_reply: string | null;
  status: string;
  title: string | null;
  description: string | null;
  service_type: string | null;
  is_doable: boolean | null;
  professional_notes: string | null;
  recommendations: string | null;
  estimated_price_range: string | null;
  estimated_duration: string | null;
  responded_by: string | null;
  converted_to_booking: boolean | null;
  booking_id: string | null;
  created_at: string;
  replied_at: string | null;
  updated_at: string | null;
  // joined
  client_profile?: { full_name: string | null; avatar_url: string | null };
  service?: { name: string | null; category: string | null };
}

interface BookingConsultation {
  id: string;
  client_id: string;
  service_id: string;
  master_id: string | null;
  had_before: boolean;
  how_long_ago: string | null;
  was_my_work: boolean | null;
  photo_urls: string[] | null;
  additional_notes: string | null;
  status: string;
  booking_link_token: string | null;
  approval_expires_at: string | null;
  master_notes: string | null;
  responded_at: string | null;
  converted_to_booking: boolean | null;
  booking_id: string | null;
  created_at: string;
  updated_at: string | null;
  // joined
  client_profile?: { full_name: string | null; avatar_url: string | null };
  service?: { name: string | null; category: string | null };
}

interface ConsultationResponse {
  id: string;
  client_id: string;
  master_id: string | null;
  service_id: string | null;
  appointment_id: string | null;
  has_had_before: boolean | null;
  was_with_this_master: boolean | null;
  time_since_last: string | null;
  additional_answers: Record<string, string> | null;
  consultation_notes: string | null;
  consultation_completed: boolean | null;
  consultation_required: boolean | null;
  created_at: string;
  updated_at: string | null;
  // joined
  client_profile?: { full_name: string | null; avatar_url: string | null };
  service?: { name: string | null; category: string | null };
  appointment?: { service_name: string | null; start_time: string | null; status: string | null };
}

interface ServiceOption {
  id: string;
  name: string;
  category: string | null;
  requires_consultation: boolean;
  consultation_questions: Record<string, string>[] | null;
}

// ─── Helpers ────────────────────────────────────────────────────────
const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    pending: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: <Clock size={12} />, label: 'Pending' },
    // booking_consultations statuses
    approved: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: <CheckCircle2 size={12} />, label: 'Approved' },
    declined: { bg: 'bg-red-50 border-red-200', text: 'text-red-600', icon: <XCircle size={12} />, label: 'Declined' },
    chat_requested: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-600', icon: <MessageCircle size={12} />, label: 'Chat Requested' },
    // photo_consultations statuses (check constraint: pending|in_review|responded|closed)
    in_review: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-600', icon: <Clock size={12} />, label: 'In review' },
    responded: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: <CheckCircle2 size={12} />, label: 'Responded' },
    closed: { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-600', icon: <XCircle size={12} />, label: 'Closed' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text}`}>
      {s.icon} {s.label}
    </span>
  );
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Main Page ──────────────────────────────────────────────────────
export default function ConsultationsPage() {
  const { user, profile, role } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMasterOrOwner = role === 'master' || role === 'owner';

  // Tabs
  const clientTabs = ['New Request', 'My Requests', 'Pre-Service Forms'] as const;
  const masterTabs = ['Photo Reviews', 'Booking Reviews', 'Assessments'] as const;
  const tabs = isMasterOrOwner ? masterTabs : clientTabs;
  type TabType = (typeof tabs)[number];
  const [activeTab, setActiveTab] = useState<string>(tabs[0]);

  // Data
  const [photoConsultations, setPhotoConsultations] = useState<PhotoConsultation[]>([]);
  const [bookingConsultations, setBookingConsultations] = useState<BookingConsultation[]>([]);
  const [consultationResponses, setConsultationResponses] = useState<ConsultationResponse[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);

  // New Request form (client)
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formServiceType, setFormServiceType] = useState('');
  const [formPhotos, setFormPhotos] = useState<File[]>([]);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Detail view
  const [selectedConsultation, setSelectedConsultation] = useState<PhotoConsultation | BookingConsultation | null>(null);
  const [detailType, setDetailType] = useState<'photo' | 'booking' | null>(null);

  // Master review form
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDoable, setReviewDoable] = useState<boolean | null>(null);
  const [reviewRecommendations, setReviewRecommendations] = useState('');
  const [reviewPriceRange, setReviewPriceRange] = useState('');
  const [reviewDuration, setReviewDuration] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Pre-service questionnaire (client)
  const [selectedAppointment, setSelectedAppointment] = useState<{ id: string; service_id: string; service_name: string; master_id: string; start_time: string } | null>(null);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({});
  const [hadBefore, setHadBefore] = useState(false);
  const [wasWithMaster, setWasWithMaster] = useState(false);
  const [timeSinceLast, setTimeSinceLast] = useState('');
  const [questionnaireNotes, setQuestionnaireNotes] = useState('');
  const [questionnaireSubmitting, setQuestionnaireSubmitting] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<{ id: string; service_id: string; service_name: string; master_id: string; start_time: string; has_response: boolean }[]>([]);

  // ─── Fetch ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Services
      const { data: svcData } = await supabase
        .from('services')
        .select('id, name, category, requires_consultation, consultation_questions')
        .eq('is_active', true);
      if (svcData) setServices(svcData as ServiceOption[]);

      if (isMasterOrOwner) {
        // Photo consultations for master
        const { data: pcData } = await supabase
          .from('photo_consultations')
          .select('*, client_profile:client_id(full_name, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(50);
        if (pcData) setPhotoConsultations(pcData as unknown as PhotoConsultation[]);

        // Booking consultations
        const { data: bcData } = await supabase
          .from('booking_consultations')
          .select('*, client_profile:client_id(full_name, avatar_url), service:service_id(name, category)')
          .order('created_at', { ascending: false })
          .limit(50);
        if (bcData) setBookingConsultations(bcData as unknown as BookingConsultation[]);

        // Consultation responses
        const { data: crData } = await supabase
          .from('consultation_responses')
          .select('*, client_profile:client_id(full_name, avatar_url), service:service_id(name, category), appointment:appointment_id(service_name, start_time, status)')
          .order('created_at', { ascending: false })
          .limit(50);
        if (crData) setConsultationResponses(crData as unknown as ConsultationResponse[]);
      } else {
        // Client: own photo consultations
        const { data: pcData } = await supabase
          .from('photo_consultations')
          .select('*')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false });
        if (pcData) setPhotoConsultations(pcData as unknown as PhotoConsultation[]);

        // Client: own booking consultations
        const { data: bcData } = await supabase
          .from('booking_consultations')
          .select('*, service:service_id(name, category)')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false });
        if (bcData) setBookingConsultations(bcData as unknown as BookingConsultation[]);

        // Upcoming appointments needing pre-service questionnaire
        const { data: apptData } = await supabase
          .from('appointments')
          .select('id, service_id, service_name, master_id, start_time')
          .eq('client_id', user.id)
          .in('status', ['confirmed', 'pending'])
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(20);

        if (apptData && apptData.length > 0) {
          // Check which already have responses
          const { data: existingResponses } = await supabase
            .from('consultation_responses')
            .select('appointment_id')
            .eq('client_id', user.id)
            .in('appointment_id', apptData.map(a => a.id));
          const answeredIds = new Set((existingResponses || []).map(r => r.appointment_id));

          // Only show appointments for services that require consultation
          const consultServices = new Set(
            (svcData || []).filter(s => s.requires_consultation).map(s => s.id)
          );

          setUpcomingAppointments(
            apptData
              .filter(a => a.service_id && consultServices.has(a.service_id))
              .map(a => ({
                id: a.id,
                service_id: a.service_id!,
                service_name: a.service_name || 'Service',
                master_id: a.master_id,
                start_time: a.start_time,
                has_response: answeredIds.has(a.id),
              }))
          );
        }
      }
    } catch (err) {
      console.error('Failed to fetch consultations:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isMasterOrOwner, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Photo upload ─────────────────────────────────────────────────
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + formPhotos.length > 5) {
      showToast('Maximum 5 photos allowed', 'error');
      return;
    }
    const compressed: File[] = [];
    const previews: string[] = [];
    for (const f of files) {
      const c = await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
      compressed.push(c as File);
      previews.push(URL.createObjectURL(c));
    }
    setFormPhotos(prev => [...prev, ...compressed]);
    setFormPhotoPreview(prev => [...prev, ...previews]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(formPhotoPreview[idx]);
    setFormPhotos(prev => prev.filter((_, i) => i !== idx));
    setFormPhotoPreview(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── Submit new photo consultation (client) ───────────────────────
  const handleSubmitConsultation = async () => {
    if (!user || formPhotos.length === 0) {
      showToast('Please add at least one photo', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const uploadedUrls: string[] = [];
      for (const photo of formPhotos) {
        const ext = photo.name?.split('.').pop() || 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('consultation-photos').upload(path, photo);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('consultation-photos').getPublicUrl(path);
        uploadedUrls.push(urlData.publicUrl);
      }

      const { error: insertErr } = await supabase.from('photo_consultations').insert({
        client_id: user.id,
        photo_url: uploadedUrls[0],
        photo_urls: uploadedUrls,
        title: formTitle.trim() || null,
        description: formDescription.trim() || null,
        service_type: formServiceType || null,
        client_message: formDescription.trim() || null,
        status: 'pending',
      });
      if (insertErr) throw insertErr;

      showToast('Consultation request submitted!', 'success');
      setFormTitle('');
      setFormDescription('');
      setFormServiceType('');
      setFormPhotos([]);
      setFormPhotoPreview([]);
      setActiveTab('My Requests');
      fetchData();
    } catch (err) {
      const { message, details } = describeError(err);
      console.error('Submit error:', message, details);
      showToast(`Failed to submit consultation: ${message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Master review photo consultation ─────────────────────────────
  const handleReviewSubmit = async (consultationId: string, action: 'approved' | 'declined') => {
    if (!user) return;
    setReviewSubmitting(true);
    try {
      const { error } = await supabase
        .from('photo_consultations')
        .update({
          // photo_consultations.status only accepts pending|in_review|responded|closed.
          // The approve/decline distinction is already captured by is_doable below.
          status: 'responded',
          master_reply: reviewNotes.trim() || null,
          master_id: user.id,
          responded_by: user.id,
          replied_at: new Date().toISOString(),
          is_doable: reviewDoable,
          professional_notes: reviewNotes.trim() || null,
          recommendations: reviewRecommendations.trim() || null,
          estimated_price_range: reviewPriceRange.trim() || null,
          estimated_duration: reviewDuration.trim() || null,
        })
        .eq('id', consultationId);
      if (error) throw error;

      showToast(`Consultation ${action}!`, 'success');
      setSelectedConsultation(null);
      setDetailType(null);
      resetReviewForm();
      fetchData();
    } catch (err) {
      const { message, details } = describeError(err);
      console.error('Review error:', message, details);
      showToast(`Failed to submit review: ${message}`, 'error');
    } finally {
      setReviewSubmitting(false);
    }
  };

  // ─── Master review booking consultation ───────────────────────────
  const handleBookingReview = async (consultationId: string, action: 'approved' | 'declined') => {
    if (!user) return;
    setReviewSubmitting(true);
    try {
      const { error } = await supabase
        .from('booking_consultations')
        .update({
          status: action,
          master_id: user.id,
          master_notes: reviewNotes.trim() || null,
          responded_at: new Date().toISOString(),
          approval_expires_at: action === 'approved' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
        })
        .eq('id', consultationId);
      if (error) throw error;

      showToast(`Booking consultation ${action}!`, 'success');
      setSelectedConsultation(null);
      setDetailType(null);
      resetReviewForm();
      fetchData();
    } catch (err) {
      const { message, details } = describeError(err);
      console.error('Booking review error:', message, details);
      showToast(`Failed to submit review: ${message}`, 'error');
    } finally {
      setReviewSubmitting(false);
    }
  };

  // ─── Submit pre-service questionnaire (client) ────────────────────
  const handleQuestionnaireSubmit = async () => {
    if (!user || !selectedAppointment) return;
    setQuestionnaireSubmitting(true);
    try {
      const { error } = await supabase.from('consultation_responses').insert({
        client_id: user.id,
        master_id: selectedAppointment.master_id,
        service_id: selectedAppointment.service_id,
        appointment_id: selectedAppointment.id,
        has_had_before: hadBefore,
        was_with_this_master: wasWithMaster,
        time_since_last: timeSinceLast || null,
        additional_answers: Object.keys(questionnaireAnswers).length > 0 ? questionnaireAnswers : null,
        consultation_notes: questionnaireNotes.trim() || null,
        consultation_completed: true,
      });
      if (error) throw error;

      showToast('Pre-service form submitted!', 'success');
      setSelectedAppointment(null);
      resetQuestionnaireForm();
      fetchData();
    } catch (err) {
      const { message, details } = describeError(err);
      console.error('Questionnaire error:', message, details);
      showToast(`Failed to submit form: ${message}`, 'error');
    } finally {
      setQuestionnaireSubmitting(false);
    }
  };

  const resetReviewForm = () => {
    setReviewNotes('');
    setReviewDoable(null);
    setReviewRecommendations('');
    setReviewPriceRange('');
    setReviewDuration('');
  };

  const resetQuestionnaireForm = () => {
    setQuestionnaireAnswers({});
    setHadBefore(false);
    setWasWithMaster(false);
    setTimeSinceLast('');
    setQuestionnaireNotes('');
  };

  const openDetail = (item: PhotoConsultation | BookingConsultation, type: 'photo' | 'booking') => {
    setSelectedConsultation(item);
    setDetailType(type);
    resetReviewForm();
    if (type === 'photo') {
      const pc = item as PhotoConsultation;
      setReviewNotes(pc.professional_notes || pc.master_reply || '');
      setReviewDoable(pc.is_doable);
      setReviewRecommendations(pc.recommendations || '');
      setReviewPriceRange(pc.estimated_price_range || '');
      setReviewDuration(pc.estimated_duration || '');
    } else {
      const bc = item as BookingConsultation;
      setReviewNotes(bc.master_notes || '');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto animate-fade-in">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[var(--color-brand-pink)]" />
        </div>
      </div>
    );
  }

  // ─── Detail/Review Panel ──────────────────────────────────────────
  if (selectedConsultation && detailType) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <button
          onClick={() => { setSelectedConsultation(null); setDetailType(null); }}
          className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to consultations
        </button>

        {detailType === 'photo' && (() => {
          const pc = selectedConsultation as PhotoConsultation;
          const allPhotos = pc.photo_urls?.length ? pc.photo_urls : [pc.photo_url];
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Photos */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-[var(--color-border-light)]">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-[var(--color-text-primary)]">
                        {pc.title || 'Photo Consultation'}
                      </h3>
                      {statusBadge(pc.status)}
                    </div>
                    {pc.client_profile && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        From: {pc.client_profile.full_name || 'Client'}
                      </p>
                    )}
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{formatDate(pc.created_at)}</p>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    {allPhotos.map((url, i) => (
                      <img key={i} src={url} alt={`Consultation photo ${i + 1}`} className="w-full rounded-xl object-cover aspect-square border border-[var(--color-border-light)]" />
                    ))}
                  </div>
                  {(pc.description || pc.client_message) && (
                    <div className="px-5 pb-4">
                      <p className="text-sm text-[var(--color-text-secondary)]">{pc.description || pc.client_message}</p>
                    </div>
                  )}
                  {pc.service_type && (
                    <div className="px-5 pb-4">
                      <span className="text-xs font-medium text-[var(--color-brand-pink-dark)] bg-[var(--color-brand-pink-light)] px-2.5 py-1 rounded-full">
                        {pc.service_type}
                      </span>
                    </div>
                  )}
                </div>

                {/* Existing master reply (client view) */}
                {!isMasterOrOwner && pc.status !== 'pending' && (
                  <div className="rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl overflow-hidden shadow-sm p-5 space-y-3">
                    <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">Professional Feedback</h4>
                    {pc.is_doable !== null && (
                      <div className="flex items-center gap-2">
                        {pc.is_doable ? (
                          <span className="flex items-center gap-1 text-sm text-emerald-600"><ThumbsUp size={14} /> Doable</span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-red-500"><ThumbsDown size={14} /> Not recommended</span>
                        )}
                      </div>
                    )}
                    {pc.master_reply && <p className="text-sm text-[var(--color-text-secondary)]">{pc.master_reply}</p>}
                    {pc.recommendations && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Recommendations</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">{pc.recommendations}</p>
                      </div>
                    )}
                    {(pc.estimated_price_range || pc.estimated_duration) && (
                      <div className="flex gap-4">
                        {pc.estimated_price_range && (
                          <div className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)]">
                            <DollarSign size={14} className="text-[var(--color-text-muted)]" /> {pc.estimated_price_range}
                          </div>
                        )}
                        {pc.estimated_duration && (
                          <div className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)]">
                            <Timer size={14} className="text-[var(--color-text-muted)]" /> {pc.estimated_duration}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Master review form */}
              {isMasterOrOwner && pc.status === 'pending' && (
                <div className="rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl overflow-hidden shadow-sm p-5 space-y-4 h-fit">
                  <h3 className="font-semibold text-[var(--color-text-primary)]">Your Assessment</h3>

                  <div>
                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Is this doable?</label>
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => setReviewDoable(true)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${reviewDoable === true ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-emerald-200'}`}>
                        <ThumbsUp size={14} /> Yes, doable
                      </button>
                      <button onClick={() => setReviewDoable(false)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${reviewDoable === false ? 'bg-red-50 border-red-300 text-red-600' : 'border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-red-200'}`}>
                        <ThumbsDown size={14} /> Not recommended
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Professional Notes</label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Your professional assessment..."
                      rows={3}
                      className="w-full mt-2 px-4 py-3 rounded-xl border border-[var(--color-border-light)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]/25 transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Recommendations</label>
                    <textarea
                      value={reviewRecommendations}
                      onChange={(e) => setReviewRecommendations(e.target.value)}
                      placeholder="What do you recommend?"
                      rows={2}
                      className="w-full mt-2 px-4 py-3 rounded-xl border border-[var(--color-border-light)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]/25 transition-all resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Est. Price Range</label>
                      <input
                        type="text"
                        value={reviewPriceRange}
                        onChange={(e) => setReviewPriceRange(e.target.value)}
                        placeholder="e.g. €50-80"
                        className="w-full mt-2 px-4 py-2.5 rounded-xl border border-[var(--color-border-light)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]/25 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Est. Duration</label>
                      <input
                        type="text"
                        value={reviewDuration}
                        onChange={(e) => setReviewDuration(e.target.value)}
                        placeholder="e.g. 1-2 hours"
                        className="w-full mt-2 px-4 py-2.5 rounded-xl border border-[var(--color-border-light)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]/25 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleReviewSubmit(pc.id, 'approved')}
                      disabled={reviewSubmitting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {reviewSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Approve & Send Feedback
                    </button>
                    <button
                      onClick={() => handleReviewSubmit(pc.id, 'declined')}
                      disabled={reviewSubmitting}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      <XCircle size={14} /> Decline
                    </button>
                  </div>
                </div>
              )}

              {/* Already reviewed */}
              {isMasterOrOwner && pc.status !== 'pending' && (
                <div className="rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl overflow-hidden shadow-sm p-5 space-y-3 h-fit">
                  <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">Your Review</h4>
                  {pc.is_doable !== null && (
                    <div className="flex items-center gap-2">
                      {pc.is_doable ? (
                        <span className="flex items-center gap-1 text-sm text-emerald-600"><ThumbsUp size={14} /> Marked as doable</span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm text-red-500"><ThumbsDown size={14} /> Marked not recommended</span>
                      )}
                    </div>
                  )}
                  {pc.professional_notes && <p className="text-sm text-[var(--color-text-secondary)]">{pc.professional_notes}</p>}
                  {pc.recommendations && <p className="text-sm text-[var(--color-text-secondary)]"><span className="font-medium">Recommendations:</span> {pc.recommendations}</p>}
                </div>
              )}
            </div>
          );
        })()}

        {detailType === 'booking' && (() => {
          const bc = selectedConsultation as BookingConsultation;
          const allPhotos = bc.photo_urls || [];
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Consultation details */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-[var(--color-border-light)]">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-[var(--color-text-primary)]">Booking Consultation</h3>
                      {statusBadge(bc.status)}
                    </div>
                    {bc.client_profile && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        From: {bc.client_profile.full_name || 'Client'}
                      </p>
                    )}
                    {bc.service && (
                      <span className="inline-block mt-1 text-xs font-medium text-[var(--color-brand-pink-dark)] bg-[var(--color-brand-pink-light)] px-2.5 py-1 rounded-full">
                        {bc.service.name}
                      </span>
                    )}
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{formatDate(bc.created_at)}</p>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-xl bg-[var(--color-surface-light)]">
                        <p className="text-xs text-[var(--color-text-muted)] mb-1">Had this service before?</p>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{bc.had_before ? 'Yes' : 'No'}</p>
                      </div>
                      {bc.had_before && (
                        <>
                          <div className="p-3 rounded-xl bg-[var(--color-surface-light)]">
                            <p className="text-xs text-[var(--color-text-muted)] mb-1">How long ago?</p>
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">{bc.how_long_ago || 'Not specified'}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-[var(--color-surface-light)]">
                            <p className="text-xs text-[var(--color-text-muted)] mb-1">Was your work?</p>
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">{bc.was_my_work === true ? 'Yes' : bc.was_my_work === false ? 'No' : 'Not specified'}</p>
                          </div>
                        </>
                      )}
                    </div>

                    {bc.additional_notes && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Client Notes</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">{bc.additional_notes}</p>
                      </div>
                    )}

                    {allPhotos.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Photos</p>
                        <div className="grid grid-cols-3 gap-2">
                          {allPhotos.map((url, i) => (
                            <img key={i} src={url} alt={`Photo ${i + 1}`} className="w-full rounded-xl object-cover aspect-square border border-[var(--color-border-light)]" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Client: show master feedback */}
                {!isMasterOrOwner && bc.master_notes && (
                  <div className="rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl overflow-hidden shadow-sm p-5">
                    <h4 className="font-semibold text-sm text-[var(--color-text-primary)] mb-2">Master Feedback</h4>
                    <p className="text-sm text-[var(--color-text-secondary)]">{bc.master_notes}</p>
                  </div>
                )}
              </div>

              {/* Master review form */}
              {isMasterOrOwner && bc.status === 'pending' && (
                <div className="rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl overflow-hidden shadow-sm p-5 space-y-4 h-fit">
                  <h3 className="font-semibold text-[var(--color-text-primary)]">Review & Decide</h3>
                  <div>
                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Your Notes / Feedback</label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Notes for the client..."
                      rows={4}
                      className="w-full mt-2 px-4 py-3 rounded-xl border border-[var(--color-border-light)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]/25 transition-all resize-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleBookingReview(bc.id, 'approved')}
                      disabled={reviewSubmitting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {reviewSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Approve Booking
                    </button>
                    <button
                      onClick={() => handleBookingReview(bc.id, 'declined')}
                      disabled={reviewSubmitting}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      <XCircle size={14} /> Decline
                    </button>
                  </div>
                </div>
              )}

              {isMasterOrOwner && bc.status !== 'pending' && bc.master_notes && (
                <div className="rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl overflow-hidden shadow-sm p-5 h-fit">
                  <h4 className="font-semibold text-sm text-[var(--color-text-primary)] mb-2">Your Notes</h4>
                  <p className="text-sm text-[var(--color-text-secondary)]">{bc.master_notes}</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  // ─── Pre-Service Questionnaire (client) ───────────────────────────
  if (selectedAppointment) {
    const svc = services.find(s => s.id === selectedAppointment.service_id);
    const questions = (svc?.consultation_questions as unknown as { question: string; type?: string }[]) || [];
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <button
          onClick={() => { setSelectedAppointment(null); resetQuestionnaireForm(); }}
          className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-[var(--color-border-light)]">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Pre-Service Questionnaire</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {selectedAppointment.service_name} — {new Date(selectedAppointment.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="p-6 space-y-5">
            {/* Standard questions */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={hadBefore} onChange={(e) => setHadBefore(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-[var(--color-brand-pink)] focus:ring-[var(--color-brand-pink)]" />
                <span className="text-sm text-[var(--color-text-primary)]">Have you had this service before?</span>
              </label>
            </div>

            {hadBefore && (
              <>
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={wasWithMaster} onChange={(e) => setWasWithMaster(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-[var(--color-brand-pink)] focus:ring-[var(--color-brand-pink)]" />
                    <span className="text-sm text-[var(--color-text-primary)]">Was it with this professional?</span>
                  </label>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">How long ago?</label>
                  <select
                    value={timeSinceLast}
                    onChange={(e) => setTimeSinceLast(e.target.value)}
                    className="w-full mt-2 px-4 py-2.5 rounded-xl border border-[var(--color-border-light)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]/25 transition-all"
                  >
                    <option value="">Select...</option>
                    <option value="less_than_month">Less than a month ago</option>
                    <option value="1_3_months">1-3 months ago</option>
                    <option value="3_6_months">3-6 months ago</option>
                    <option value="6_12_months">6-12 months ago</option>
                    <option value="over_year">Over a year ago</option>
                  </select>
                </div>
              </>
            )}

            {/* Dynamic questions from service config */}
            {questions.map((q, idx) => (
              <div key={idx}>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{q.question || `Question ${idx + 1}`}</label>
                <textarea
                  value={questionnaireAnswers[`q_${idx}`] || ''}
                  onChange={(e) => setQuestionnaireAnswers(prev => ({ ...prev, [`q_${idx}`]: e.target.value }))}
                  placeholder="Your answer..."
                  rows={2}
                  className="w-full mt-2 px-4 py-3 rounded-xl border border-[var(--color-border-light)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]/25 transition-all resize-none"
                />
              </div>
            ))}

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Additional Notes</label>
              <textarea
                value={questionnaireNotes}
                onChange={(e) => setQuestionnaireNotes(e.target.value)}
                placeholder="Anything else your professional should know..."
                rows={3}
                className="w-full mt-2 px-4 py-3 rounded-xl border border-[var(--color-border-light)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]/25 transition-all resize-none"
              />
            </div>

            <button
              onClick={handleQuestionnaireSubmit}
              disabled={questionnaireSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[var(--color-brand-pink)] to-[var(--color-secondary)] hover:opacity-90 transition-all disabled:opacity-50"
            >
              {questionnaireSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit Questionnaire
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main view ────────────────────────────────────────────────────
  const pendingPhotoCount = photoConsultations.filter(c => c.status === 'pending').length;
  const pendingBookingCount = bookingConsultations.filter(c => c.status === 'pending').length;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Consultations</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {isMasterOrOwner ? 'Review client consultations and pre-service assessments' : 'Request consultations and complete pre-service forms'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-surface-light)] p-1 rounded-xl mb-6 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          let badge = 0;
          if (isMasterOrOwner) {
            if (tab === 'Photo Reviews') badge = pendingPhotoCount;
            if (tab === 'Booking Reviews') badge = pendingBookingCount;
          }
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-white text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {tab}
              {badge > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-brand-pink)] text-white text-[10px] font-bold flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Client: New Request ─────────────────────────────────── */}
      {!isMasterOrOwner && activeTab === 'New Request' && (
        <div className="max-w-2xl">
          <div className="rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-[var(--color-border-light)]">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <Camera size={20} className="text-[var(--color-brand-pink)]" /> Request Photo Consultation
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">Send photos for a professional to review before your appointment</p>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Hair colour advice"
                  className="w-full mt-2 px-4 py-2.5 rounded-xl border border-[var(--color-border-light)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]/25 transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Service Type</label>
                <select
                  value={formServiceType}
                  onChange={(e) => setFormServiceType(e.target.value)}
                  className="w-full mt-2 px-4 py-2.5 rounded-xl border border-[var(--color-border-light)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]/25 transition-all"
                >
                  <option value="">Select a service type...</option>
                  {[...new Set(services.map(s => s.category).filter(Boolean))].map(cat => (
                    <option key={cat} value={cat!}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Description / Message</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe what you'd like advice on..."
                  rows={3}
                  className="w-full mt-2 px-4 py-3 rounded-xl border border-[var(--color-border-light)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]/25 transition-all resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Photos (up to 5)</label>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {formPhotoPreview.map((url, i) => (
                    <div key={i} className="relative aspect-square">
                      <img src={url} alt={`Preview ${i + 1}`} className="w-full h-full rounded-xl object-cover border border-[var(--color-border-light)]" />
                      <button onClick={() => removePhoto(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {formPhotos.length < 5 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-[var(--color-border-light)] flex flex-col items-center justify-center gap-1 text-[var(--color-text-muted)] hover:border-[var(--color-brand-pink)] hover:text-[var(--color-brand-pink)] transition-colors cursor-pointer"
                    >
                      <Upload size={16} />
                      <span className="text-[10px] font-medium">Add</span>
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>

              <button
                onClick={handleSubmitConsultation}
                disabled={submitting || formPhotos.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[var(--color-brand-pink)] to-[var(--color-secondary)] hover:opacity-90 transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Submit Consultation Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Client: My Requests (waiting screen) ────────────────── */}
      {!isMasterOrOwner && activeTab === 'My Requests' && (
        <div className="space-y-3">
          {photoConsultations.length === 0 && bookingConsultations.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-brand-pink-light)] to-[var(--color-lavender)] flex items-center justify-center mx-auto mb-4">
                <FileText size={28} className="text-[var(--color-brand-pink-dark)]" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">No consultations yet</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Submit a photo consultation to get started</p>
              <button onClick={() => setActiveTab('New Request')} className="mt-4 text-sm font-semibold text-[var(--color-brand-pink-dark)] hover:underline">
                + New Request
              </button>
            </div>
          ) : (
            <>
              {/* Photo consultations */}
              {photoConsultations.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Camera size={14} /> Photo Consultations
                  </h3>
                  <div className="space-y-2">
                    {photoConsultations.map(pc => {
                      const thumb = pc.photo_urls?.[0] || pc.photo_url;
                      return (
                        <button
                          key={pc.id}
                          data-row-id={pc.id}
                          onClick={() => openDetail(pc, 'photo')}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl hover:shadow-md transition-all text-left"
                        >
                          <img src={thumb} alt="" className="w-14 h-14 rounded-xl object-cover border border-[var(--color-border-light)] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{pc.title || 'Photo Consultation'}</p>
                              {statusBadge(pc.status)}
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                              {pc.service_type && <span className="font-medium">{pc.service_type} · </span>}
                              {formatDate(pc.created_at)}
                              {pc.photo_urls && pc.photo_urls.length > 1 && ` · ${pc.photo_urls.length} photos`}
                            </p>
                            {pc.status === 'pending' && (
                              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                <Clock size={11} /> Waiting for professional review...
                              </p>
                            )}
                          </div>
                          <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Booking consultations */}
              {bookingConsultations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ClipboardList size={14} /> Booking Consultations
                  </h3>
                  <div className="space-y-2">
                    {bookingConsultations.map(bc => (
                      <button
                        key={bc.id}
                        data-row-id={bc.id}
                        onClick={() => openDetail(bc, 'booking')}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl hover:shadow-md transition-all text-left"
                      >
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--color-brand-pink-light)] to-[var(--color-lavender)] flex items-center justify-center shrink-0">
                          <ClipboardList size={20} className="text-[var(--color-brand-pink-dark)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                              {bc.service?.name || 'Booking Consultation'}
                            </p>
                            {statusBadge(bc.status)}
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-1">{formatDate(bc.created_at)}</p>
                          {bc.status === 'pending' && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                              <Clock size={11} /> Awaiting approval...
                            </p>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Client: Pre-Service Forms ───────────────────────────── */}
      {!isMasterOrOwner && activeTab === 'Pre-Service Forms' && (
        <div className="space-y-3">
          {upcomingAppointments.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-brand-pink-light)] to-[var(--color-lavender)] flex items-center justify-center mx-auto mb-4">
                <ClipboardList size={28} className="text-[var(--color-brand-pink-dark)]" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">No pre-service forms needed</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Forms will appear here when you have upcoming appointments that require one</p>
            </div>
          ) : (
            upcomingAppointments.map(appt => (
              <div
                key={appt.id}
                className="flex items-center gap-4 p-4 rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-brand-pink-light)] to-[var(--color-lavender)] flex items-center justify-center shrink-0">
                  <ClipboardList size={20} className="text-[var(--color-brand-pink-dark)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{appt.service_name}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {new Date(appt.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {appt.has_response ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                    <CheckCircle2 size={12} /> Completed
                  </span>
                ) : (
                  <button
                    onClick={() => setSelectedAppointment(appt)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[var(--color-brand-pink)] to-[var(--color-secondary)] px-4 py-2 rounded-full hover:opacity-90 transition-all"
                  >
                    Fill Form <ChevronRight size={12} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Master: Photo Reviews ───────────────────────────────── */}
      {isMasterOrOwner && activeTab === 'Photo Reviews' && (
        <div className="space-y-3">
          {photoConsultations.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-brand-pink-light)] to-[var(--color-lavender)] flex items-center justify-center mx-auto mb-4">
                <Eye size={28} className="text-[var(--color-brand-pink-dark)]" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">No photo consultations</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Photo consultation requests will appear here</p>
            </div>
          ) : (
            photoConsultations.map(pc => {
              const thumb = pc.photo_urls?.[0] || pc.photo_url;
              return (
                <button
                  key={pc.id}
                  data-row-id={pc.id}
                  onClick={() => openDetail(pc, 'photo')}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl hover:shadow-md transition-all text-left"
                >
                  <img src={thumb} alt="" className="w-14 h-14 rounded-xl object-cover border border-[var(--color-border-light)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {pc.title || 'Photo Consultation'}
                      </p>
                      {statusBadge(pc.status)}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      {pc.client_profile?.full_name || 'Client'} · {formatDate(pc.created_at)}
                      {pc.service_type && ` · ${pc.service_type}`}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
                </button>
              );
            })
          )}
        </div>
      )}

      {/* ─── Master: Booking Reviews ─────────────────────────────── */}
      {isMasterOrOwner && activeTab === 'Booking Reviews' && (
        <div className="space-y-3">
          {bookingConsultations.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-brand-pink-light)] to-[var(--color-lavender)] flex items-center justify-center mx-auto mb-4">
                <CalendarPlus size={28} className="text-[var(--color-brand-pink-dark)]" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">No booking consultations</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Pre-booking consultation requests will appear here</p>
            </div>
          ) : (
            bookingConsultations.map(bc => (
              <button
                key={bc.id}
                data-row-id={bc.id}
                onClick={() => openDetail(bc, 'booking')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl hover:shadow-md transition-all text-left"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--color-brand-pink-light)] to-[var(--color-lavender)] flex items-center justify-center shrink-0">
                  <ClipboardList size={20} className="text-[var(--color-brand-pink-dark)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {bc.service?.name || 'Booking Consultation'}
                    </p>
                    {statusBadge(bc.status)}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {bc.client_profile?.full_name || 'Client'} · {formatDate(bc.created_at)}
                  </p>
                  {bc.had_before && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      Had before: Yes{bc.how_long_ago ? ` (${bc.how_long_ago})` : ''}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
              </button>
            ))
          )}
        </div>
      )}

      {/* ─── Master: Assessments ─────────────────────────────────── */}
      {isMasterOrOwner && activeTab === 'Assessments' && (
        <div className="space-y-3">
          {consultationResponses.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-brand-pink-light)] to-[var(--color-lavender)] flex items-center justify-center mx-auto mb-4">
                <ClipboardList size={28} className="text-[var(--color-brand-pink-dark)]" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">No pre-service assessments</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Client questionnaire responses will appear here</p>
            </div>
          ) : (
            consultationResponses.map(cr => (
              <div
                key={cr.id}
                data-row-id={cr.id}
                className="p-4 rounded-2xl border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-secondary)] flex items-center justify-center text-white font-semibold text-sm shrink-0 overflow-hidden">
                    {cr.client_profile?.avatar_url ? (
                      <img src={cr.client_profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (cr.client_profile?.full_name?.charAt(0) || 'C').toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {cr.client_profile?.full_name || 'Client'}
                      </p>
                      <span className="text-xs text-[var(--color-text-muted)]">{formatDate(cr.created_at)}</span>
                    </div>
                    {cr.service && (
                      <span className="inline-block mt-1 text-xs font-medium text-[var(--color-brand-pink-dark)] bg-[var(--color-brand-pink-light)] px-2 py-0.5 rounded-full">
                        {cr.service.name}
                      </span>
                    )}
                    {cr.appointment && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Appointment: {cr.appointment.service_name} — {cr.appointment.start_time ? new Date(cr.appointment.start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </p>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-[var(--color-surface-light)] text-xs">
                        <span className="text-[var(--color-text-muted)]">Had before:</span>{' '}
                        <span className="font-medium text-[var(--color-text-primary)]">{cr.has_had_before ? 'Yes' : 'No'}</span>
                      </div>
                      {cr.has_had_before && (
                        <>
                          <div className="p-2 rounded-lg bg-[var(--color-surface-light)] text-xs">
                            <span className="text-[var(--color-text-muted)]">With you:</span>{' '}
                            <span className="font-medium text-[var(--color-text-primary)]">{cr.was_with_this_master ? 'Yes' : 'No'}</span>
                          </div>
                          {cr.time_since_last && (
                            <div className="p-2 rounded-lg bg-[var(--color-surface-light)] text-xs">
                              <span className="text-[var(--color-text-muted)]">How long ago:</span>{' '}
                              <span className="font-medium text-[var(--color-text-primary)]">{cr.time_since_last.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {cr.additional_answers && Object.keys(cr.additional_answers).length > 0 && (
                      <div className="mt-3 space-y-1">
                        {Object.entries(cr.additional_answers).map(([key, val]) => (
                          <div key={key} className="text-xs">
                            <span className="text-[var(--color-text-muted)]">{key.replace(/^q_/, 'Q')}:</span>{' '}
                            <span className="text-[var(--color-text-secondary)]">{val}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {cr.consultation_notes && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                        <p className="text-xs text-amber-800">
                          <StickyNote size={11} className="inline mr-1" />
                          {cr.consultation_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
