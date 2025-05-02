// components/HeroSection.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import WhyChooseSection from "../components/WhyChooseSection";
import PriceSection from "../components/A";
import { Gsap } from "../utils/gasp";
import ScheduleSection from "../components/B";
import ContactSection from "../components/Contact";
import LocationSection from "../components/Map";

const HeroSection = () => {
 const heroRef = useRef<HTMLDivElement>(null);
 useEffect(() => {
  if (heroRef.current) {
   const elements = heroRef.current.querySelectorAll("nav, h2, p, a");

   Gsap.fromTo(
    elements,
    {
     y: 50,
     opacity: 0,
     // ✅ 여기에서 배경은 명시적으로 포함시키지 않음
    },
    {
     y: 0,
     opacity: 1,
     duration: 0.8,
     ease: "power4.out",
     stagger: 0.1,
     clearProps: "opacity,transform", // ✅ inline style 제거
     scrollTrigger: {
      trigger: heroRef.current,
      start: "top 80%",
      toggleActions: "play none none none",
     },
    }
   );
  }
 }, []);
 const [navSolid, setNavSolid] = useState(false);

 useEffect(() => {
  const handleScroll = () => {
   const scrolled = window.scrollY;
   setNavSolid(scrolled > window.innerHeight);
  };

  window.addEventListener("scroll", handleScroll);
  return () => window.removeEventListener("scroll", handleScroll);
 }, []);

 return (
  <div className="   text-[#444444] ">
   <div
    id="Hero"
    ref={heroRef}
    className="min-h-[100svh] bg-hero-animated relative flex flex-col items-center  px-6 py-12 "
   >
    {/* Header / Navigation */}
    <nav className="fixed px-5 !bg-transparent md:px-0 top-5 z-50 w-full max-w-6xl flex justify-between items-center mb-12  duration-300">
     <h1
      onClick={() => {
       document.getElementById("Hero")?.scrollIntoView();
      }}
      className="text-2xl font-serif font-bold tracking-tight italic underline"
     >
      Fasea
     </h1>
     <div className="space-x-2 md:space-x-3 ">
      {["About", "Plan", "Contact"].map((item) => (
       <button
        key={item}
        onClick={() => {
         document.getElementById(item)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
         });
        }}
        className={`px-4 py-2  text-sm font-medium  rounded-full border border-[#DFD1C9] cursor-pointer  text-[#444444] hover:bg-[#DFD1C9] transition ${
         navSolid ? "bg-white/90 " : ""
        }`}
       >
        {item}
       </button>
      ))}
     </div>
    </nav>

    {/* Hero Content */}
    <main className="!bg-transparent mt-5 absolute px-4 top-1/2 -translate-y-1/2 text-center  flex flex-col items-center">
     <h2 className="font-serif !bg-transparent  text-4xl sm:text-5xl font-extrabold mb-6 leading-snug">
      Your Personal <br /> Pilates Studio for Wellness & Balance
     </h2>
     <p className="!bg-transparent text-lg sm:text-xl text-[#716D64] max-w-xl mb-8">
      Fasea is your space to strengthen your body and calm your mind. Start your
      journey today.
     </p>
     <a
      target="_blank"
      aria-label="Book Link"
      href="https://www.instagram.com/fasea.pilates"
      className="px-6 py-3   rounded-full text-white text-sm font-medium button-gradient button-shadow-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-[1.04] hover:brightness-110 hover:shadow-lg"
     >
      DM to Book
     </a>
    </main>
   </div>
   <WhyChooseSection />
   <PriceSection />
   <ScheduleSection />
   <ContactSection />
   <LocationSection />
   <section className="py-24 px-6 bg-[#F8F0EE] text-[#444444] text-center">
    <h3 className="font-serif text-3xl sm:text-4xl font-bold mb-6">
     Ready to begin your Pilates journey?
    </h3>
    <p className="text-[#716D64] text-base sm:text-lg mb-10">
     Your body deserves to feel strong, calm, and centered.
    </p>
    <a
     target="_blank"
     aria-label="Book Link"
     href="https://www.instagram.com/fasea.pilates"
     className="px-6 py-3 rounded-full text-white font-medium button-gradient button-shadow-md hover:opacity-90 transition"
    >
     Book Your First Class
    </a>
   </section>
  </div>
 );
};

export default HeroSection;
