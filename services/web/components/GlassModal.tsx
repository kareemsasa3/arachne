'use client';

import type { ReactNode } from 'react';

interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export default function GlassModal({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
}: GlassModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white/10 border border-white/15 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="sticky top-0 bg-black/30 border-b border-white/10 backdrop-blur-md p-5 flex items-start justify-between gap-3">
            <div className="flex-1 mr-4">
              {title && <h2 className="text-xl font-bold text-white">{title}</h2>}
              {subtitle && <p className="text-sm text-white/80 break-all">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}

        <div className="p-5 space-y-4">{children}</div>

        {footer && (
          <div className="sticky bottom-0 bg-black/30 border-t border-white/10 backdrop-blur-md p-4 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

