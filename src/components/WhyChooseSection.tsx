"use client";

import UserGroupIcon from "@heroicons/react/24/outline/UserGroupIcon";
import SparklesIcon from "@heroicons/react/24/outline/SparklesIcon";
import HeartIcon from "@heroicons/react/24/outline/HeartIcon";
import { useEffect, useRef } from "react";
import { Gsap } from "../utils/gasp";

const WhyChooseSection = () => {
 const sectionRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
  if (sectionRef.current) {
   Gsap.fromTo(
    sectionRef.current.querySelectorAll(".card"),
    { y: 40, opacity: 0 },
    {
     y: 0,
     opacity: 1,
     duration: 1,
     stagger: 0.2,
     ease: "circ.out",
     scrollTrigger: {
      trigger: sectionRef.current,
      start: "top 80%",
      toggleActions: "play none none none",
     },
    }
   );
  }
 }, []);

 const cards = [
  {
   icon: <UserGroupIcon className="h-10 w-10 text-[#9B9B7B] mx-auto mb-4" />,
   title: "Personalized Guidance",
   desc: "Tailored sessions designed to match your level and body goals.",
  },
  {
   icon: <SparklesIcon className="h-10 w-10 text-[#9B9B7B] mx-auto mb-4" />,
   title: "Elegant Environment",
   desc: "Calm, curated interiors designed for focus and relaxation.",
  },
  {
   icon: <HeartIcon className="h-10 w-10 text-[#9B9B7B] mx-auto mb-4" />,
   title: "Mindful Practice",
   desc: "We emphasize breath, presence, and balance in every movement.",
  },
 ];

 return (
  <section
   id="Service"
   ref={sectionRef}
   className="py-24 px-6 bg-[#FAF8F6] text-[#444444]"
  >
   <div id="About" className="max-w-6xl mx-auto text-center mb-12">
    <h3 className="font-serif text-3xl sm:text-4xl font-bold">
     Why Choose Fasea
    </h3>
   </div>
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 max-w-5xl mx-auto text-center">
    {cards.map((card, idx) => (
     <div key={idx} className="card p-4">
      {card.icon}
      <h4 className="font-serif text-xl mb-2">{card.title}</h4>
      <p className="text-[#716D64] text-sm">{card.desc}</p>
     </div>
    ))}
   </div>
  </section>
 );
};

export default WhyChooseSection;
