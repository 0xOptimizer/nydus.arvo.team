'use client';

import { MotionConfig } from 'motion/react';
import { useNavigation } from '@/context/NavigationContext';

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { isPending } = useNavigation();

  return (
    <MotionConfig reducedMotion="user">
    <div className="z-1 flex-1 overflow-y-auto p-8 w-full overflow-x-hidden">
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-20' : 'opacity-100'}`}>
        {children}
      </div>
      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-50">
          <div className="flex flex-col items-center gap-3">
            {/* <i className="fa-solid fa-spinner fa-spin-pulse text-3xl text-primary"></i>
            <span className="text-sm text-muted-foreground">Loading page...</span> */}
          </div>
        </div>
      )}
    </div>
    </MotionConfig>
  );
}