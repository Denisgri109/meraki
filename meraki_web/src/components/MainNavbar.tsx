'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useNotifications, type NotificationItem } from '@/contexts/NotificationsContext';
import {
  Home, Calendar, Search, ShoppingBag, GraduationCap, Gift,
  MessageSquare, Settings, LogOut, Menu, X, ChevronDown,
  Scissors, Clock, Package, BarChart3, Boxes, DollarSign, Wallet,
  Bell, ShoppingCart, CalendarCheck, Inbox, ClipboardList, HelpCircle, Megaphone
} from 'lucide-react';

// ─── Navigation items ─────────────────────────────────────────────
const clientNav = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/booking', label: 'Book', icon: Calendar },
  { href: '/dashboard/discover', label: 'Discover', icon: Search },
  { href: '/dashboard/shop', label: 'Shop', icon: ShoppingBag },
  { href: '/dashboard/orders', label: 'Orders', icon: Package },
  { href: '/dashboard/academy', label: 'Academy', icon: GraduationCap },
  { href: '/dashboard/loyalty', label: 'Rewards', icon: Gift },
  { href: '/dashboard/consultations', label: 'Consults', icon: ClipboardList },
];

const ownerNav = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/appointments', label: 'Bookings', icon: CalendarCheck },
  { href: '/dashboard/finance', label: 'Finance', icon: DollarSign },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/dashboard/inventory', label: 'Inventory', icon: Package },
  { href: '/dashboard/supplies', label: 'Supplies', icon: Boxes },
  { href: '/dashboard/academy', label: 'Academy', icon: GraduationCap },
  { href: '/dashboard/loyalty', label: 'Rewards', icon: Gift },
  { href: '/dashboard/consultations', label: 'Consults', icon: ClipboardList },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Megaphone },
  { href: '/dashboard/discover', label: 'Discover', icon: Search },
];

const masterNav = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/appointments', label: 'Bookings', icon: CalendarCheck },
  { href: '/dashboard/earnings', label: 'Earnings', icon: Wallet },
  { href: '/dashboard/availability', label: 'Schedule', icon: Clock },
  { href: '/dashboard/services', label: 'Services', icon: Scissors },
  { href: '/dashboard/supplies', label: 'Supplies', icon: Boxes },
  { href: '/dashboard/loyalty', label: 'Rewards', icon: Gift },
  { href: '/dashboard/consultations', label: 'Consults', icon: ClipboardList },
];

interface MainNavbarProps {
  transparent?: boolean;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!t) return '';
  const diff = Date.now() - t;
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function notificationHref(n: NotificationItem): string {
  if (n.appointment_id) return '/dashboard/appointments';
  if (n.type === 'message') return '/dashboard/chat';
  return '/dashboard/appointments';
}

export function MainNavbar({ transparent = false }: MainNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, role, signOut, loading } = useAuth();
  const { getItemCount } = useCart();
  const { unreadMessages, notifications, unreadNotifications, markNotificationsSeen } = useNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const cartItemCount = getItemCount();
  const displayName = profile?.full_name || (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null) || user?.email || 'User';
  const displayEmail = profile?.email || user?.email || '';
  const displayInitial = displayName.charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar_url || (typeof user?.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null) || null;

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allNav = useMemo(() => {
    if (role === 'owner') return ownerNav;
    if (role === 'master') return masterNav;
    return clientNav;
  }, [role]);

  const handleNotificationsToggle = () => {
    const next = !notificationsOpen;
    setNotificationsOpen(next);
    if (next) markNotificationsSeen();
    setProfileOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return <header className={`h-16 ${transparent ? 'absolute top-0 left-0 right-0 z-50' : 'sticky top-0 z-50 border-b border-gray-100 bg-white/80'}`} />;
  }

  // Not authenticated
  if (!user) {
    return (
      <header className={`${transparent ? 'absolute top-0 left-0 right-0 z-50' : 'sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100'} h-16 flex items-center justify-between px-6 lg:px-12`}>
        <Link href="/" className={`text-2xl font-[family-name:var(--font-playfair)] italic drop-shadow-sm ${transparent ? 'text-white drop-shadow-md' : 'text-[var(--color-primary)]'}`}>
          Merakí
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className={`text-sm font-medium transition-colors px-4 py-2 ${transparent ? 'text-white/90 hover:text-white' : 'text-gray-700 hover:text-black'}`}>
            Sign In
          </Link>
          <Link href="/register" className={`text-sm font-semibold px-5 py-2.5 rounded-full transition-colors shadow-md ${transparent ? 'bg-white text-[var(--color-primary)] hover:bg-white/90 shadow-lg' : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90'}`}>
            Get Started
          </Link>
        </div>
      </header>
    );
  }

  // Authenticated
  return (
    <header className={`${transparent ? 'relative' : 'sticky'} top-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-[var(--color-brand-pink)]/20 shadow-[0_2px_10px_rgba(232,160,180,0.05)]`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-8">
            <Link href={pathname === '/' ? '/' : '/dashboard'} className="flex items-center gap-2 shrink-0">
              <span className="text-2xl font-[family-name:var(--font-playfair)] italic text-[var(--color-primary)]">Merakí</span>
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden lg:flex items-center gap-1">
              {allNav.map((item) => {
                const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'nav-active-gradient'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-brand-pink-dark)] hover:bg-[var(--color-brand-pink-light)]'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Actions + Profile */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/cart"
              className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-brand-pink-light)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-brand-pink-dark)]"
              title="Cart"
            >
              <ShoppingCart size={18} />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[var(--color-brand-pink-dark)] text-white text-[10px] font-bold flex items-center justify-center">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </Link>

            {/* Chat icon with unread badge */}
            <Link
              href="/dashboard/chat"
              className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-brand-pink-light)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-brand-pink-dark)]"
              title="Messages"
            >
              <MessageSquare size={18} />
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[var(--color-brand-pink-dark)] text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </Link>

            {/* Notifications dropdown */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={handleNotificationsToggle}
                className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-brand-pink-light)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-brand-pink-dark)] cursor-pointer"
                title="Notifications"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell size={18} />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border border-white">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[92vw] bg-white rounded-[var(--radius-xl)] shadow-lg border border-[var(--color-border-light)] py-2 animate-fade-in z-50">
                  <div className="px-4 py-2 border-b border-[var(--color-border-light)] flex items-center justify-between">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">Notifications</p>
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                      {notifications.length ? `${notifications.length} recent` : 'all clear'}
                    </span>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-10 h-10 rounded-full bg-[var(--color-brand-pink-light)] flex items-center justify-center mb-2">
                          <Inbox size={18} className="text-[var(--color-brand-pink-dark)]" />
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">You&apos;re all caught up</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <Link
                          key={n.id}
                          href={notificationHref(n)}
                          onClick={() => setNotificationsOpen(false)}
                          className="flex gap-3 px-4 py-3 hover:bg-[var(--color-surface-light)] transition-colors border-b last:border-b-0 border-[var(--color-border-light)]/60"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-brand-pink-dark)] flex items-center justify-center shrink-0">
                            {n.type === 'message' ? (
                              <MessageSquare size={14} className="text-white" />
                            ) : (
                              <Calendar size={14} className="text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{n.title}</p>
                            <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{n.body}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{formatRelative(n.created_at)}</p>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full hover:bg-[var(--color-brand-pink-light)] transition-all cursor-pointer"
                aria-label="Toggle profile menu"
                aria-expanded={profileOpen}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-brand-pink-dark)] flex items-center justify-center text-white text-sm font-semibold overflow-hidden">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    displayInitial
                  )}
                </div>
                <span className="hidden sm:block text-sm font-medium text-[var(--color-text-primary)] max-w-[100px] truncate">
                  {displayName.split(' ')[0] || 'User'}
                </span>
                <ChevronDown size={14} className={`text-[var(--color-text-muted)] transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-[var(--radius-xl)] shadow-lg border border-[var(--color-border-light)] py-2 animate-fade-in z-50">
                  <div className="px-4 py-3 border-b border-[var(--color-border-light)]">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{displayName}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{displayEmail}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-brand-pink-light)] text-[var(--color-brand-pink-dark)]">
                      {role || 'client'}
                    </span>
                  </div>
                  <div className="py-1">
                    <Link href="/dashboard/appointments" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text-primary)] transition-colors">
                      <Calendar size={16} /> My Appointments
                    </Link>
                    <Link href="/dashboard/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text-primary)] transition-colors">
                      <Settings size={16} /> Settings
                    </Link>
                    <Link href="/dashboard/support" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text-primary)] transition-colors">
                      <HelpCircle size={16} /> Support
                    </Link>
                  </div>
                  <div className="border-t border-[var(--color-border-light)] pt-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-error)] hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-brand-pink-light)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-brand-pink-dark)]"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Nav Dropdown ────────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[var(--color-border-light)] bg-white animate-fade-in absolute w-full left-0 z-40 shadow-md">
          <nav className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-3 gap-2">
            {allNav.map((item) => {
              const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard');
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-[var(--radius-lg)] text-xs font-medium transition-all ${
                    isActive
                      ? 'nav-active-gradient'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-brand-pink-dark)] hover:bg-[var(--color-brand-pink-light)]'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
