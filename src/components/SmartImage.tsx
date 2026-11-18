import { useEffect, useState } from 'react';
import { Store } from 'lucide-react';

interface SmartImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  loading?: 'lazy' | 'eager';
}

export function SmartImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackTitle,
  loading = 'lazy',
}: SmartImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-4 text-center select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-2 text-slate-400">
          <Store className="w-5 h-5" />
        </div>
        {fallbackTitle && (
          <span className="text-xs font-medium text-slate-500 line-clamp-2 max-w-[220px]">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
      loading={loading}
      decoding="async"
    />
  );
}
