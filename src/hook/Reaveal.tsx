"use client";

import { useEffect, useRef } from "react";

interface RevealTriggerProps {
 rootSelector: string; // 예: "#Hero", ".some-section"
}

const RevealTrigger = ({ rootSelector }: RevealTriggerProps) => {
 const initializedRef = useRef(false);

 useEffect(() => {
  if (initializedRef.current) return; // 한 번만 작동
  initializedRef.current = true;

  const rootElement = document.querySelector<HTMLElement>(rootSelector);
  if (!rootElement) return;

  const elements = Array.from(
   rootElement.querySelectorAll<HTMLElement>(".reveal")
  );
  if (!elements.length) return;

  const observer = new IntersectionObserver(
   (entries, obs) => {
    entries.forEach((entry) => {
     const el = entry.target as HTMLElement;
     if (entry.isIntersecting) {
      const index = elements.indexOf(el);
      el.style.animationDelay = `${index * 0.25}s`;
      el.classList.add("fade-in-up");
      obs.unobserve(el);
     }
    });
   },
   {
    root: null, // viewport 기준
    rootMargin: "0px 0px -10% 0px",
   }
  );

  elements.forEach((el) => observer.observe(el));

  return () => observer.disconnect();
 }, [rootSelector]);

 return null;
};

export default RevealTrigger;
