'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const iconMap: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 size={18} />,
    error: <AlertCircle size={18} />,
    info: <Info size={18} />,
  };

  const colorMap: Record<ToastType, string> = {
    success: 'linear-gradient(135deg, #22c55e, #16a34a)',
    error: 'linear-gradient(135deg, #ef4444, #dc2626)',
    info: 'linear-gradient(135deg, #3b82f6, #2563eb)',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 18px',
              borderRadius: 14,
              background: colorMap[toast.type],
              color: 'white',
              fontSize: 14,
              fontWeight: 600,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              animation: 'toastSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
              maxWidth: 380,
              backdropFilter: 'blur(8px)',
            }}
          >
            {iconMap[toast.type]}
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: 8,
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Animation keyframes */}
      <style jsx global>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(60px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
