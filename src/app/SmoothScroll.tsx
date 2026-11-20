import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ReactLenis, type LenisRef } from 'lenis/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router';

import { useReducedMotion } from '@/hooks/use-reduced-motion';

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooths the page scroll; GSAP's ticker drives it so ScrollTrigger and Lenis share one clock.
 * With reduced motion, scrolling is the browser's own.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);
  const reduced = useReducedMotion();
  const { pathname } = useLocation();

  useEffect(() => {
    if (reduced) return;
    const update = (time: number) => lenisRef.current?.lenis?.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    const lenis = lenisRef.current?.lenis;
    lenis?.on('scroll', ScrollTrigger.update);
    return () => {
      gsap.ticker.remove(update);
      lenis?.off('scroll', ScrollTrigger.update);
    };
  }, [reduced]);

  // A new page starts at the top.
  useEffect(() => {
    lenisRef.current?.lenis?.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }, [pathname]);

  if (reduced) return <>{children}</>;
  return (
    <ReactLenis root ref={lenisRef} options={{ autoRaf: false, lerp: 0.11, wheelMultiplier: 0.95, smoothWheel: true }}>
      {children}
    </ReactLenis>
  );
}
