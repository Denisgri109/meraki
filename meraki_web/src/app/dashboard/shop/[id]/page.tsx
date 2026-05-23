'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Package, ShoppingBag, Truck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';

interface Product {
  id: string;
  name: string;
  description: string | null;
  retail_price: number;
  wholesale_price: number;
  image_url: string | null;
  category: string | null;
  stock_count: number;
  is_active: boolean;
  is_preview?: boolean;
  is_digital?: boolean | null;
  shipping_weight_kg?: number | null;
}

const fallbackImages = [
  'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=900&q=80&auto=format&fit=crop',
];

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    stock_count: product.stock_count ?? 0,
    is_active: product.is_active ?? true,
  };
}

export default function ShopProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { role } = useAuth();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const productId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isMasterOrOwner = role === 'master' || role === 'owner';
  const price = useMemo(() => {
    if (!product) return 0;
    return isMasterOrOwner ? product.wholesale_price : product.retail_price;
  }, [isMasterOrOwner, product]);
  const imageUrl = product?.image_url || fallbackImages[Math.max(0, product?.name.length || 0) % fallbackImages.length];

  useEffect(() => {
    let mounted = true;

    const loadProduct = async () => {
      setLoading(true);
      setError(null);

      if (!productId || !isUuid(productId)) {
        if (mounted) {
          setProduct(null);
          setError('Product not found');
          setLoading(false);
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .or('is_active.eq.true,is_active.is.null')
        .maybeSingle();

      if (!mounted) return;

      if (fetchError) {
        setProduct(null);
        setError(fetchError.message);
      } else if (!data) {
        setProduct(null);
        setError('Product not found');
      } else {
        setProduct(normalizeProduct(data as Product));
      }

      setLoading(false);
    };

    void loadProduct();

    return () => {
      mounted = false;
    };
  }, [productId, supabase]);

  const handleAddToBag = () => {
    if (!product) return;
    if (product.is_preview) {
      showToast('Preview item only. Add real products from Inventory to sell online.', 'info');
      return;
    }
    if (product.stock_count === 0) {
      showToast('This product is out of stock', 'error');
      return;
    }
    const added = addToCart({
      id: product.id,
      name: product.name,
      price,
      image_url: product.image_url,
      stock_count: product.stock_count,
    });
    showToast(added ? `${product.name} added to bag!` : 'Stock limit reached for this product', added ? 'success' : 'error');
  };

  if (loading) {
    return (
      <div className="animate-fade-in max-w-5xl mx-auto">
        <div className="glass-card p-10 min-h-[520px] flex items-center justify-center">
          <Loader2 size={34} className="animate-spin text-[var(--color-brand-pink-dark)]" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="animate-fade-in max-w-3xl mx-auto">
        <div className="glass-card p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-amber-100/60 to-transparent rounded-bl-full" />
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-200 to-orange-200 flex items-center justify-center mx-auto mb-5">
            <Package size={34} className="text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3">Product unavailable</h1>
          <p className="text-[var(--color-text-secondary)] mb-8">{error || 'This shop item could not be loaded.'}</p>
          <Link href="/dashboard/shop" className="btn-pink inline-flex items-center gap-2 px-7 py-3 text-sm">
            Back to Shop <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <button onClick={() => router.back()} className="btn-outline inline-flex items-center gap-2 px-5 py-2.5 text-sm mb-6">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
        <div className="glass-card overflow-hidden">
          <div className="aspect-[4/3] relative overflow-hidden bg-[var(--color-surface-light)]">
            <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            {product.category && (
              <span className="absolute bottom-5 left-5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/90 text-[var(--color-text-primary)] shadow-sm backdrop-blur-sm">
                {product.category}
              </span>
            )}
          </div>
        </div>

        <aside className="glass-card p-6 lg:sticky lg:top-24">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)] mb-2">MERAKÍ SHOP</p>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3">{product.name}</h1>
          <div className="flex items-center gap-3 mb-5">
            {product.stock_count > 0 ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                <CheckCircle2 size={13} /> In stock
              </span>
            ) : (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">Out of stock</span>
            )}
          </div>

          <div className="mb-6">
            <span className="text-4xl font-bold text-[var(--color-text-primary)]">£{price.toFixed(2)}</span>
            {isMasterOrOwner && product.retail_price !== product.wholesale_price && (
              <span className="text-sm text-[var(--color-text-muted)] line-through ml-3">£{product.retail_price.toFixed(2)}</span>
            )}
            {isMasterOrOwner && <p className="text-xs font-semibold text-amber-600 mt-1">Wholesale pricing applied</p>}
          </div>

          <p className="text-sm leading-6 text-[var(--color-text-secondary)] mb-6">
            {product.description || 'Premium beauty essential selected for the Merakí shop.'}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-2xl bg-[var(--color-surface-light)] p-4">
              <Package size={18} className="text-[var(--color-brand-pink-dark)] mb-2" />
              <p className="text-xs text-[var(--color-text-muted)]">Stock</p>
              <p className="font-bold text-[var(--color-text-primary)]">{product.stock_count} available</p>
            </div>
            <div className="rounded-2xl bg-[var(--color-surface-light)] p-4">
              <Truck size={18} className="text-[var(--color-brand-pink-dark)] mb-2" />
              <p className="text-xs text-[var(--color-text-muted)]">Shipping</p>
              <p className="font-bold text-[var(--color-text-primary)]">At checkout</p>
            </div>
          </div>

          <button
            onClick={handleAddToBag}
            disabled={product.stock_count === 0}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShoppingBag size={16} /> {product.stock_count === 0 ? 'Out of Stock' : 'Add to Bag'}
          </button>
          <Link href="/dashboard/cart" className="btn-outline w-full py-3 text-sm flex items-center justify-center gap-2 mt-3">
            View Cart <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
