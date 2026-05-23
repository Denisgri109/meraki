'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface DebugResults {
  envUrl?: string;
  envKeyPresent?: boolean;
  services?: { data: Record<string, unknown>[] | null; error: string | null; count: number };
  products?: { data: Record<string, unknown>[] | null; error: string | null; count: number };
  auth?: {
    hasSession: boolean;
    userId: string | null;
    email: string | null;
    error: string | null;
  };
  profile?: { data: Record<string, unknown> | null; error: string | null };
}

export default function DebugPage() {
  const [results, setResults] = useState<DebugResults>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const out: DebugResults = {};

      // Test 1: Check env vars
      out.envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING';
      out.envKeyPresent = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Test 2: Fetch services (public, no auth needed)
      const { data: services, error: sErr } = await supabase
        .from('services')
        .select('id, name, base_price, is_active')
        .eq('is_active', true);
      out.services = { data: services, error: sErr?.message || null, count: services?.length || 0 };

      // Test 3: Fetch products (public, no auth needed)
      const { data: products, error: pErr } = await supabase
        .from('products')
        .select('id, name, retail_price, is_active')
        .eq('is_active', true);
      out.products = { data: products, error: pErr?.message || null, count: products?.length || 0 };

      // Test 4: Check auth session
      const { data: { session }, error: authErr } = await supabase.auth.getSession();
      out.auth = {
        hasSession: !!session,
        userId: session?.user?.id || null,
        email: session?.user?.email || null,
        error: authErr?.message || null,
      };

      // Test 5: If logged in, fetch profile
      if (session?.user) {
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('id, full_name, role, loyalty_points')
          .eq('id', session.user.id)
          .single();
        out.profile = { data: profile, error: profErr?.message || null };
      }

      setResults(out);
      setLoading(false);
    };
    run();
  }, []);

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">🔧 Database Connection Debug</h1>
      {loading ? (
        <p className="text-gray-500">Running tests...</p>
      ) : (
        <pre className="bg-gray-900 text-green-300 p-6 rounded-xl overflow-auto text-sm whitespace-pre-wrap font-mono">
          {JSON.stringify(results, null, 2)}
        </pre>
      )}
    </div>
  );
}
