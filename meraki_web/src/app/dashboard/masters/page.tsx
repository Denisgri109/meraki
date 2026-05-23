'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Search, MapPin, Mail, Phone, MoreVertical, Eye, UserPlus, Check, X, Clock } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface Master {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  specialties: string[] | null;
  city: string | null;
  is_master: boolean;
  commission_rate: number | null;
}

interface Application {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  status: string;
  specialties: string[] | null;
  created_at: string | null;
  bio: string | null;
  years_of_experience: number | null;
}

export default function MastersPage() {
  const supabase = createClient();
  const { showToast } = useToast();
  const router = useRouter();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'active' | 'applications'>('active');
  const [masters, setMasters] = useState<Master[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  
  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  
  // Review Modal
  const [reviewApp, setReviewApp] = useState<Application | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (activeTab === 'active') {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, avatar_url, specialties, city, is_master, commission_rate')
          .eq('is_master', true)
          .order('full_name');
        setMasters((data as unknown as Master[]) || []);
      } else {
        const { data } = await supabase
          .from('master_applications')
          .select('id, full_name, email, phone, city, status, specialties, created_at, bio, years_of_experience')
          .order('created_at', { ascending: false });
        setApplications((data as unknown as Application[]) || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [supabase, activeTab]);

  const filteredMasters = masters.filter((m) =>
    !search || m.full_name?.toLowerCase().includes(search.toLowerCase()) || (m.specialties || []).some((s) => s?.toLowerCase().includes(search.toLowerCase()))
  );
  
  const filteredApps = applications.filter((a) =>
    !search || a.full_name?.toLowerCase().includes(search.toLowerCase()) || a.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleRemoveMaster = async (id: string, name: string | null) => {
    if (!window.confirm(`Are you sure you want to deactivate ${name || 'this master'}?`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_master: false, master_status: 'deactivated' })
        .eq('id', id);
        
      if (error) throw error;
      
      setMasters(prev => prev.filter(m => m.id !== id));
      showToast('Master deactivated successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to deactivate master', 'error');
    } finally {
      setOpenDropdown(null);
    }
  };
  
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.functions.invoke('invite-master', {
        body: { email: inviteEmail, full_name: inviteName },
      });
      const errorMessage = error?.message || data?.error || (typeof data === 'string' ? data : null);
      if (errorMessage) throw new Error(errorMessage);
      if (!data?.success) throw new Error('Unexpected response from server');
      if (data?.email_sent) {
        showToast('Invitation email sent!', 'success');
      } else {
        showToast('Invitation recorded (email delivery pending — check RESEND_API_KEY)', 'info');
      }
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
      if (activeTab === 'applications') {
        const { data: apps } = await supabase.from('master_applications').select('*').order('created_at', { ascending: false });
        setApplications((apps as unknown as Application[]) || []);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already exists')) {
        showToast('An application with this email already exists', 'error');
      } else {
        showToast(msg || 'Failed to invite master', 'error');
      }
    }
  };
  
  const handleReviewAction = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('master_applications')
        .update({ 
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id 
        })
        .eq('id', id);
        
      if (error) throw error;
      
      setApplications(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
      showToast(`Application ${newStatus}`, 'success');
      setReviewApp(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update application', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users size={22} className="text-[var(--color-secondary)]" />
            <h1 className="text-3xl font-semibold text-[var(--color-text-primary)]">Masters</h1>
          </div>
          <p className="text-[var(--color-text-secondary)]">Manage your beauty professionals</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowInviteModal(true)}
            className="btn-pink flex items-center gap-2"
          >
            <UserPlus size={18} /> Invite Master
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border-light)] mb-6">
        <button
          className={`pb-3 px-4 font-medium transition-colors ${activeTab === 'active' ? 'border-b-2 border-[var(--color-brand-pink)] text-[var(--color-brand-pink-dark)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
          onClick={() => setActiveTab('active')}
        >
          Active Masters ({masters.length})
        </button>
        <button
          className={`pb-3 px-4 font-medium transition-colors ${activeTab === 'applications' ? 'border-b-2 border-[var(--color-brand-pink)] text-[var(--color-brand-pink-dark)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
          onClick={() => setActiveTab('applications')}
        >
          Applications & Invites
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Search by name, email or specialty..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-glass pl-11 w-full"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[var(--color-surface-light)]" />
              <div className="flex-1">
                <div className="h-4 bg-[var(--color-surface-light)] rounded w-1/4 mb-2" />
                <div className="h-3 bg-[var(--color-surface-light)] rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'active' ? (
        /* Active Masters List */
        filteredMasters.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <Users size={48} className="mx-auto text-[var(--color-text-muted)] mb-4" />
            <p className="text-lg font-medium text-[var(--color-text-secondary)]">No masters found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMasters.map((master) => (
              <div key={master.id} className="glass-card p-5 hover:shadow-lg transition-all duration-200 group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-secondary)] flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden">
                    {master.avatar_url ? (
                       <img src={master.avatar_url} alt={master.full_name || ''} className="w-full h-full object-cover" />
                    ) : master.full_name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-[var(--color-text-primary)]">{master.full_name}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                      <span>{(master.specialties && master.specialties.length > 0) ? master.specialties.join(', ') : 'No specialty'}</span>
                      {master.city && (
                        <span className="flex items-center gap-0.5"><MapPin size={10} />{master.city}</span>
                      )}
                      {master.commission_rate != null && (
                        <span className="font-medium text-[var(--color-text-secondary)]">{master.commission_rate}% commission</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {master.email && (
                      <a href={`mailto:${master.email}`} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] transition-colors text-[var(--color-text-muted)]">
                        <Mail size={16} />
                      </a>
                    )}
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === master.id ? null : master.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] transition-colors text-[var(--color-text-muted)] cursor-pointer"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openDropdown === master.id && (
                        <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-[var(--color-border-light)] py-1 z-50 animate-fade-in">
                          <button
                            onClick={() => { router.push(`/dashboard/masters/${master.id}`); setOpenDropdown(null); }}
                            className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)] flex items-center gap-2 cursor-pointer"
                          >
                            <Eye size={14} /> View Profile
                          </button>
                          <button
                            onClick={() => handleRemoveMaster(master.id, master.full_name)}
                            className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                          >
                            Deactivate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Applications List */
        filteredApps.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <Search size={48} className="mx-auto text-[var(--color-text-muted)] mb-4" />
            <p className="text-lg font-medium text-[var(--color-text-secondary)]">No applications or invites found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredApps.map((app) => (
              <div key={app.id} className="glass-card p-5 flex items-center justify-between hover:shadow-md transition-all">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-[var(--color-text-primary)]">{app.full_name}</p>
                    {app.status === 'pending' && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">Pending</span>}
                    {app.status === 'invited' && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">Invited</span>}
                    {app.status === 'approved' && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">Approved</span>}
                    {app.status === 'rejected' && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">Rejected</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1"><Mail size={12}/> {app.email}</span>
                    {app.city && <span className="flex items-center gap-1"><MapPin size={12}/> {app.city}</span>}
                  </div>
                </div>
                <div>
                  <button onClick={() => setReviewApp(app)} className="btn-secondary px-4 py-1.5 text-sm">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Invite Master</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Full Name</label>
                  <input type="text" required value={inviteName} onChange={e => setInviteName(e.target.value)} className="input-glass w-full" placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Email Address</label>
                  <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="input-glass w-full" placeholder="jane@example.com" />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setShowInviteModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-pink">Send Invitation</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Review Modal */}
      {reviewApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[var(--radius-xl)] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Application Review</h3>
              <button onClick={() => setReviewApp(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Personal Info</h4>
                <p className="font-semibold text-lg">{reviewApp.full_name}</p>
                <p className="text-sm text-[var(--color-text-muted)] flex items-center gap-1 mt-1"><Mail size={14}/> {reviewApp.email}</p>
                {reviewApp.phone && <p className="text-sm text-[var(--color-text-muted)] flex items-center gap-1 mt-1"><Phone size={14}/> {reviewApp.phone}</p>}
                {reviewApp.city && <p className="text-sm text-[var(--color-text-muted)] flex items-center gap-1 mt-1"><MapPin size={14}/> {reviewApp.city}</p>}
              </div>
              <hr className="border-gray-100" />
              <div>
                <h4 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Professional</h4>
                <p className="text-sm"><strong>Experience:</strong> {reviewApp.years_of_experience || 0} years</p>
                <p className="text-sm mt-1"><strong>Specialties:</strong> {reviewApp.specialties?.join(', ') || 'None'}</p>
                <div className="mt-2 text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-light)] p-3 rounded-lg border border-[var(--color-border-light)]">
                  {reviewApp.bio || 'No bio provided.'}
                </div>
              </div>
            </div>
            
            {reviewApp.status === 'pending' && (
              <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
                <button onClick={() => handleReviewAction(reviewApp.id, 'rejected')} className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
                  <X size={16} className="mr-1 inline" /> Reject
                </button>
                <button onClick={() => handleReviewAction(reviewApp.id, 'approved')} className="btn-primary bg-emerald-500 hover:bg-emerald-600 border-emerald-500">
                  <Check size={16} className="mr-1 inline" /> Approve
                </button>
              </div>
            )}
            {reviewApp.status !== 'pending' && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-center">
                <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Status: {reviewApp.status}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

