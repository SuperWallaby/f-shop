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
   Gsap.fromTo(
    heroRef.current.querySelectorAll("nav, h2, p, button"),
    {
     y: 50,
     opacity: 0,
    },
    {
     y: 0,
     opacity: 1,
     duration: 0.8,
     ease: "power4.out",
     stagger: 0.1,
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
    className="min-h-screen bg-hero-animated relative flex flex-col items-center  px-6 py-12 "
   >
    {/* Header / Navigation */}
    <nav className="fixed px-5 md:px-0 top-5 z-50 w-full max-w-6xl flex justify-between items-center mb-12 transition-colors duration-300">
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
        className={`px-4 py-2 text-sm font-medium  rounded-full border border-[#DFD1C9] cursor-pointer  text-[#444444] hover:bg-[#DFD1C9] transition ${
         navSolid ? "bg-white/90 " : ""
        }`}
       >
        {item}
       </button>
      ))}
     </div>
    </nav>

    {/* Hero Content */}
    <main className="mt-5 absolute px-4 top-1/2 -translate-y-1/2 text-center  flex flex-col items-center">
     <h2 className="font-serif  text-4xl sm:text-5xl font-extrabold mb-6 leading-snug">
      Your Personal <br /> Pilates Studio for Wellness & Balance
     </h2>
     <p className="text-lg sm:text-xl text-[#716D64] max-w-xl mb-8">
      Fasea is your space to strengthen your body and calm your mind. Start your
      journey today.
     </p>
     <button className="px-6 py-3 font-medium  button-gradient text-white text-sm rounded-full hover:opacity-90 transition">
      Book a Session
     </button>
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
    <button className="px-6 py-3 rounded-full text-white font-medium button-gradient button-shadow-md hover:opacity-90 transition">
     Book Your First Class
    </button>
   </section>
  </div>
 );
};

export default HeroSection;
