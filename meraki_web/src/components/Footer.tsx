import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[var(--color-primary)] text-white py-12 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <span className="text-2xl font-[family-name:var(--font-playfair)] italic">Merakí</span>
          <p className="text-white/50 text-sm mt-2">Beauty with soul</p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">Platform</h4>
          <div className="space-y-2 text-sm text-white/70">
            <Link href="/dashboard/booking" className="block hover:text-white transition-colors">Book Services</Link>
            <Link href="/dashboard/shop" className="block hover:text-white transition-colors">Shop Products</Link>
            <Link href="/dashboard/academy" className="block hover:text-white transition-colors">Academy Courses</Link>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">Company</h4>
          <div className="space-y-2 text-sm text-white/70">
            <Link href="/about" className="block hover:text-white transition-colors">About Us</Link>
            <Link href="/contact" className="block hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">Legal</h4>
          <div className="space-y-2 text-sm text-white/70">
            <Link href="/privacy-policy" className="block hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms-of-service" className="block hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-white/10 text-center text-xs text-white/30">
        © {new Date().getFullYear()} Merakí. All rights reserved.
      </div>
    </footer>
  );
}
