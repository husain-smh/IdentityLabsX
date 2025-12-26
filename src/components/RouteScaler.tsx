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
  
  // Apply 75% zoom to non-socap routes (mimics browser Ctrl+- zoom)
  // Using zoom property which scales everything including layout, just like browser zoom
  const containerStyle = !isSocapRoute 
    ? { 
        zoom: 0.75
      }
    : {};

  return (
    <div style={containerStyle}>
      {children}
    </div>
  );
}

