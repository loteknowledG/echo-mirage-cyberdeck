'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type RegistryKitScrollFrameProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Single scroll region for the embedded Realmorphism Kit.
 * Restores scrollTop when async showroom sections (catalog fetch, figlet preview) reflow layout.
 */
export function RegistryKitScrollFrame({ children, className }: RegistryKitScrollFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      scrollTopRef.current = el.scrollTop;
      userScrolledRef.current = el.scrollTop > 8;
    };

    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = ref.current;
    const content = contentRef.current;
    if (!el || !content) return;

    const restoreIfJumped = () => {
      if (!userScrolledRef.current) return;
      const saved = scrollTopRef.current;
      if (saved <= 8) return;
      if (el.scrollTop < saved - 24) {
        el.scrollTop = saved;
      }
    };

    const observer = new ResizeObserver(() => {
      restoreIfJumped();
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-registry-kit-scroll
      className={cn(
        'custom-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain',
        className,
      )}
    >
      <div ref={contentRef} className="min-h-0 min-w-0">
        {children}
      </div>
    </div>
  );
}
