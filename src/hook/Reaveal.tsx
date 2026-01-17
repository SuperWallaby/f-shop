"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

interface RevealTriggerProps {
 rootSelector: string; // 예: "#Hero", ".some-section"
}

const RevealTrigger = ({ rootSelector }: RevealTriggerProps) => {
 const pathname = usePathname();
 const observerRef = useRef<IntersectionObserver | null>(null);

 useEffect(() => {
  function cleanupObserver() {
   if (observerRef.current) {
    observerRef.current.disconnect();
    observerRef.current = null;
   }
  }

  function init() {
   cleanupObserver();

   const rootElement = document.querySelector<HTMLElement>(rootSelector);
   if (!rootElement) return;

   const elements = Array.from(
    rootElement.querySelectorAll<HTMLElement>(".reveal")
   );
   if (!elements.length) return;

   const animate = (el: HTMLElement) => {
    const index = elements.indexOf(el);
    el.style.animationDelay = `${Math.max(0, index) * 0.25}s`;
    el.classList.add("fade-in-up");
   };

   // Reset so we can re-play when coming back to the page (incl. bfcache restore).
   for (const el of elements) {
    el.classList.remove("fade-in-up", "animate-fade-in-up");
    el.style.animationDelay = "";
    el.style.transitionDelay = "";
   }

   const isInView = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
   };

   const observer = new IntersectionObserver(
    (entries, obs) => {
     entries.forEach((entry) => {
      const el = entry.target as HTMLElement;
      if (entry.isIntersecting) {
       animate(el);
       obs.unobserve(el);
      }
     });
    },
    {
     root: null,
     rootMargin: "0px 0px -10% 0px",
    }
   );

   observerRef.current = observer;

   // Avoid a "flash to hidden" for elements already visible.
   for (const el of elements) {
    if (isInView(el)) {
     animate(el);
    } else {
     observer.observe(el);
    }
   }
  }

  // Initial mount + route change back to this page.
  init();

  // Handle browser back/forward bfcache restores where effects may not re-run as expected.
  const onPageShow = () => init();
  window.addEventListener("pageshow", onPageShow);

  return () => {
   window.removeEventListener("pageshow", onPageShow);
   cleanupObserver();
  };
 }, [pathname, rootSelector]);

 return null;
};

export default RevealTrigger;
