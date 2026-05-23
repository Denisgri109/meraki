'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import {
  ShoppingBag, Search, Star, Package,
  ArrowRight, Plus, X, Loader2,
} from 'lucide-react';

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
}

const fallbackImages = [
  'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400&q=80&auto=format&fit=crop',
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Failed to add product';
}

export default function ShopPage() {
  const router = useRouter();
  const supabase = createClient();
  const { role } = useAuth();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [availableCategories, setAvailableCategories] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Product modal (owner only)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', retail_price: '', wholesale_price: '', stock_count: '', category: 'Nails' });
  const [saving, setSaving] = useState(false);

  const isOwner = role === 'owner';
  const isMasterOrOwner = role === 'master' || role === 'owner';

  const fetchProducts = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('products')
        .select('*')
        .or('is_active.eq.true,is_active.is.null')
        .order('created_at', { ascending: false })
        .limit(50);
      if (fetchErr) {
        setError(fetchErr.message);
        setProducts([]);
        return;
      }
      const normalizedProducts = ((data as unknown as Product[]) || []).map((product) => ({
        ...product,
        stock_count: product.stock_count ?? 0,
        is_active: product.is_active ?? true,
      }));
      setError(null);
      setProducts(normalizedProducts);

      // Derive categories from data
      const cats = new Set(['All']);
      normalizedProducts.forEach(p => {
        if (p.category) cats.add(p.category);
      });
      setAvailableCategories(Array.from(cats).sort());
    } catch (err) {
      console.error('[Shop] unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchProducts();
    });

    const channel = supabase.channel('realtime_products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPrice = (p: Product) => (isMasterOrOwner ? p.wholesale_price : p.retail_price);

  const filtered = products.filter((p) => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleAddToBag = (product: Product) => {
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
      price: getPrice(product),
      image_url: product.image_url,
      stock_count: product.stock_count,
    });
    showToast(added ? `${product.name} added to bag!` : 'Stock limit reached for this product', added ? 'success' : 'error');
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.retail_price || !newProduct.wholesale_price) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('products').insert({
        name: newProduct.name,
        description: newProduct.description || null,
        retail_price: parseFloat(newProduct.retail_price),
        wholesale_price: parseFloat(newProduct.wholesale_price),
        stock_count: parseInt(newProduct.stock_count) || 0,
        category: newProduct.category,
        is_active: true,
      });
      if (error) throw error;
      showToast('Product added successfully!', 'success');
      setShowAddModal(false);
      setNewProduct({ name: '', description: '', retail_price: '', wholesale_price: '', stock_count: '', category: 'Nails' });
      // Realtime subscription will automatically refresh the product list
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Hero Banner */}
      <div style={{ position: 'relative', borderRadius: 'var(--radius-2xl)', overflow: 'hidden', marginBottom: '40px', height: '220px' }}>
        <img src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1600&q=80&auto=format&fit=crop" alt="Beauty products" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.3), transparent)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'white', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <ShoppingBag size={18} style={{ color: '#FCD34D' }} />
            <span style={{ fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: '#FCD34D', fontWeight: 700 }}>Shop</span>
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: 700, textShadow: '0 2px 10px rgba(0,0,0,0.3)', margin: 0 }}>Curated Beauty Products</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', marginTop: '8px', maxWidth: '400px' }}>
            Premium beauty essentials handpicked for you
            {isMasterOrOwner && <span className="block text-xs mt-1 text-amber-300">Wholesale pricing applied</span>}
          </p>
        </div>
      </div>

      {/* Search + Filter + Add */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', width: '100%', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
          <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-glass" style={{ paddingLeft: '44px', width: '100%', boxSizing: 'border-box' }} />
        </div>
        {isOwner && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-pink flex items-center gap-2 px-5 py-2.5 text-sm whitespace-nowrap"
          >
            <Plus size={16} /> Add Product
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {availableCategories.map((cat) => {
          const pillMap: Record<string, string> = { All: 'pill-all', Nails: 'pill-nails', Lashes: 'pill-lashes', Skincare: 'pill-skincare', Brows: 'pill-brows', Equipment: 'pill-equipment' };
          const pillClass = pillMap[cat] || 'bg-pink-100 text-pink-700';
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer hover:scale-105 ${
                selectedCategory === cat
                  ? `${pillClass} shadow-md`
                  : 'bg-white text-[var(--color-text-secondary)] border border-[var(--color-border-light)] hover:border-pink-200'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Error state */}
      {error && (
        <div className="glass-card p-4 mb-6 border-l-4 border-red-400 bg-red-50/50">
          <p className="text-sm text-red-600 font-medium">Failed to load products: {error}</p>
        </div>
      )}

      {/* Results count */}
      {!loading && (
        <p className="text-xs text-[var(--color-text-muted)] mb-4 font-medium">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="glass-card overflow-hidden">
              <div className="aspect-square shimmer" />
              <div className="p-4">
                <div className="h-4 shimmer rounded w-3/4 mb-2" />
                <div className="h-3 shimmer rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-100/50 to-transparent rounded-bl-full" />
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-200 to-orange-200 flex items-center justify-center mx-auto mb-4 animate-float">
            <Package size={32} className="text-amber-500" />
          </div>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">No products found</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">Check back soon for new arrivals</p>
          {search && (
            <button onClick={() => { setSearch(''); setSelectedCategory('All'); }} className="btn-outline mt-4 px-6 py-2 text-sm">
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((product, idx) => (
            <div
              key={product.id}
              data-row-id={product.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/dashboard/shop/${product.id}`)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') router.push(`/dashboard/shop/${product.id}`);
              }}
              className={`glass-card card-accent-stripe overflow-hidden hover:shadow-lg hover:-translate-y-2 transition-all duration-300 cursor-pointer group animate-scale-in stagger-${Math.min(idx + 1, 6)}`}
              style={{ animationFillMode: 'both' }}
            >
              <div className="aspect-square relative overflow-hidden">
                <img src={product.image_url || fallbackImages[idx % fallbackImages.length]} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {product.stock_count <= 5 && product.stock_count > 0 && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md">
                    {product.stock_count} left
                  </span>
                )}
                {product.stock_count === 0 && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-red-600 text-white shadow-md">
                    Sold Out
                  </span>
                )}
                {product.category && (
                  <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/90 text-[var(--color-text-primary)] shadow-sm backdrop-blur-sm">
                    {product.category}
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">MERAKÍ</p>
                <h3 className="font-semibold text-sm text-[var(--color-text-primary)] line-clamp-1 group-hover:text-gradient-pink transition-colors">{product.name}</h3>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <span className="text-lg font-bold text-[var(--color-text-primary)]">£{getPrice(product).toFixed(2)}</span>
                    {isMasterOrOwner && product.retail_price !== product.wholesale_price && (
                      <span className="text-xs text-[var(--color-text-muted)] line-through ml-2">£{product.retail_price.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddToBag(product); }}
                  disabled={product.stock_count === 0}
                  className="w-full mt-3 py-2.5 rounded-full bg-[var(--color-surface-light)] text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-all duration-300 flex items-center justify-center gap-2 group/btn cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>{product.stock_count === 0 ? 'Out of Stock' : 'Add to Bag'}</span>
                  {product.stock_count > 0 && <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto animate-scale-in" style={{ background: 'white' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Add Product</h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] cursor-pointer"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-upper">Name *</label>
                <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="input-glass" placeholder="Product name" />
              </div>
              <div>
                <label className="label-upper">Description</label>
                <textarea value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} className="input-glass resize-none" rows={3} placeholder="Product description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-upper">Retail Price (£) *</label>
                  <input type="number" step="0.01" value={newProduct.retail_price} onChange={(e) => setNewProduct({ ...newProduct, retail_price: e.target.value })} className="input-glass" placeholder="0.00" />
                </div>
                <div>
                  <label className="label-upper">Wholesale (£) *</label>
                  <input type="number" step="0.01" value={newProduct.wholesale_price} onChange={(e) => setNewProduct({ ...newProduct, wholesale_price: e.target.value })} className="input-glass" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-upper">Stock Count</label>
                  <input type="number" value={newProduct.stock_count} onChange={(e) => setNewProduct({ ...newProduct, stock_count: e.target.value })} className="input-glass" placeholder="0" />
                </div>
                <div>
                  <label className="label-upper">Category</label>
                  <select value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} className="input-glass">
                    {['Nails', 'Lashes', 'Brows', 'Skincare', 'Equipment'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddProduct}
                disabled={saving}
                className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
              >
                {saving ? <><Loader2 size={16} className="animate-spin" /> Adding...</> : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
