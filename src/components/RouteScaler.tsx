'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface RouteScalerProps {
  children: ReactNode;
}

export default function RouteScaler({ children }: RouteScalerProps) {
  const pathname = usePathname();
  
  // Check if route starts with /socap
  const isSocapRoute = pathname?.startsWith('/socap') ?? false;
  
  // Apply 75% zoom to /socap routes (mimics browser Ctrl+- zoom).
  // Using the non-standard `zoom` property because it scales layout + text together
  // similarly to browser zoom (what you get with Ctrl + -).
  const containerStyle = isSocapRoute ? ({ zoom: 0.75 } as const) : {};

  return (
    <div style={containerStyle}>
      {children}
    </div>
  );
}

