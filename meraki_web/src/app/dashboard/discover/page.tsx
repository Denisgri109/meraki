'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, MapPin, TrendingUp, Heart, Sparkles, ArrowRight, Users } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useRouter } from 'next/navigation';

interface Master {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  specialties: string | null;
  city: string | null;
  bio: string | null;
}

const trendingTags = ['Balayage', 'Gel Nails', 'Lash Extensions', 'Facial', 'Braids', 'Microblading', 'Keratin', 'Waxing'];

const tagGradients = [
  'from-pink-400 to-rose-300',
  'from-violet-400 to-purple-300',
  'from-blue-400 to-cyan-300',
  'from-emerald-400 to-teal-300',
  'from-amber-400 to-orange-300',
  'from-indigo-400 to-blue-300',
  'from-rose-400 to-pink-300',
  'from-teal-400 to-emerald-300',
];

export default function DiscoverPage() {
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, specialties, city, bio')
          .eq('is_master', true)
          .limit(24);

        if (error) console.error('[Discover] masters error:', error);
        setMasters((data as unknown as Master[]) || []);
      } catch (err) {
        console.error('[Discover] unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMasters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = masters.filter((m) =>
    !search || m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.specialties?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      {/* Hero Banner */}
      <div style={{ position: 'relative', borderRadius: 'var(--radius-2xl)', overflow: 'hidden', marginBottom: '40px', height: '220px' }}>
        <img src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600&q=80&auto=format&fit=crop" alt="Discover beauty" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.3), transparent)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'white', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Sparkles size={18} style={{ color: '#C4B5FD' }} />
            <span style={{ fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: '#C4B5FD', fontWeight: 700 }}>Discover</span>
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: 700, textShadow: '0 2px 10px rgba(0,0,0,0.3)', margin: 0 }}>Explore & Connect</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', marginTop: '8px', maxWidth: '400px' }}>Find the perfect beauty professional for you</p>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '32px', width: '100%' }}>
        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Search by name, specialty, or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-glass"
          style={{ paddingLeft: '44px', width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      {/* Trending Tags — Colorful gradient pills */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-400 to-violet-400 flex items-center justify-center">
            <TrendingUp size={14} className="text-white" />
          </div>
          <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">Popular</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {trendingTags.map((tag, idx) => (
            <button
              key={tag}
              onClick={() => setSearch(tag)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-md ${
                search === tag
                  ? `bg-gradient-to-r ${tagGradients[idx]} text-white shadow-lg`
                  : 'bg-white text-[var(--color-text-secondary)] border border-[var(--color-border-light)] hover:border-pink-200 hover:text-pink-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Professionals Grid */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-purple-400 flex items-center justify-center">
          <Users size={14} className="text-white" />
        </div>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Beauty Professionals</h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl shimmer" />
                <div className="flex-1">
                  <div className="h-4 shimmer rounded w-2/3 mb-2" />
                  <div className="h-3 shimmer rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 shimmer rounded w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-violet-100/50 to-transparent rounded-bl-full" />
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-200 to-purple-200 flex items-center justify-center mx-auto mb-4 animate-float">
            <Search size={32} className="text-violet-400" />
          </div>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">No professionals found</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">Try adjusting your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((master, idx) => (
            <div
              key={master.id}
              onClick={() => router.push(`/dashboard/booking?masterId=${master.id}`)}
              className={`glass-card p-6 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 cursor-pointer group relative animate-scale-in stagger-${Math.min(idx + 1, 6)}`}
              style={{ animationFillMode: 'both' }}
            >
              {/* Favorite Heart */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFavorites((prev) => {
                    const next = new Set(prev);
                    if (next.has(master.id)) { next.delete(master.id); showToast('Removed from favorites', 'info'); }
                    else { next.add(master.id); showToast('Added to favorites ❤️', 'success'); }
                    return next;
                  });
                }}
                className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/80 hover:bg-white hover:scale-110 transition-all shadow-sm cursor-pointer"
              >
                <Heart size={16} className={favorites.has(master.id) ? 'text-pink-500 fill-pink-500' : 'text-gray-300 hover:text-pink-400'} />
              </button>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                  {master.avatar_url ? (
                    <img src={master.avatar_url} alt={master.full_name || ''} className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    master.full_name?.charAt(0) || '?'
                  )}
                </div>
                <div>
                  <p className="font-bold text-[var(--color-text-primary)] group-hover:text-violet-600 transition-colors">
                    {master.full_name}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">{master.specialties || 'Beauty Professional'}</p>
                </div>
              </div>

              {master.bio && (
                <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-4">{master.bio}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border-light)]">
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                  {master.city && (
                    <div className="flex items-center gap-1">
                      <MapPin size={12} className="text-violet-400" />
                      <span>{master.city}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs font-bold text-violet-500 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all flex items-center gap-1">
                  View <ArrowRight size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
