import React, { useEffect, useState } from 'react';
import LoadingSpinner from './LoadingSpinner';

// Lightweight wrapper that dynamically imports Recharts and passes the module
// to a render-prop child. This keeps Recharts out of the initial bundle.
export default function LazyRecharts({
  children,
}: {
  // The Recharts module is loaded dynamically; we type it as unknown here and let
  // consuming code treat it as the appropriate module surface.
  children: (R: unknown) => React.ReactNode;
}): React.ReactElement {
  const [lib, setLib] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;
    import('recharts')
      .then(mod => {
        if (mounted) setLib(mod as unknown);
      })
      .catch(err => {
        console.error('Failed to load recharts dynamically', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!lib) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Pass the loaded module to the consumer. Consumers should narrow the module
  // (e.g. as any or a proper type) when accessing members.
  return <>{children(lib)}</>;
}
