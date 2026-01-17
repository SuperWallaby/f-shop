"use client";
import { useEffect } from "react";

export const useReveal = (
 selector: string,
 rootMargin = "0px 0px -10% 0px"
) => {
 useEffect(() => {
  const elements = Array.from(document.querySelectorAll(selector));
  if (!elements.length) return;

  const observer = new IntersectionObserver(
   (entries, obs) => {
    entries.forEach((entry) => {
     if (entry.isIntersecting) {
      const el = entry.target as HTMLElement;
      const index = Number(el.dataset.index) || 0;
      el.style.transitionDelay = `${index * 0.15}s`; // 순차 delay
      el.classList.add("animate-fade-in-up");
      obs.unobserve(el);
     }
    });
   },
   { rootMargin }
  );

  elements.forEach((el) => observer.observe(el));

  return () => observer.disconnect();
 }, [selector, rootMargin]);
};
