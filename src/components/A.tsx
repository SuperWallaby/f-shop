"use client";

import { useEffect, useRef } from "react";
import { Gsap } from "../utils/gasp";

const PriceSection = () => {
 const sectionRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
  if (sectionRef.current) {
   Gsap.fromTo(
    sectionRef.current.querySelectorAll(".price-card"),
    { y: 30, opacity: 0 },
    {
     y: 0,
     opacity: 1,
     duration: 0.8,
     ease: "circ.out",
     stagger: 0.3,
     scrollTrigger: {
      trigger: sectionRef.current,
      start: "top 80%",
      toggleActions: "play none none none",
     },
    }
   );
  }
 }, []);

 const plans = [
  {
   price: "RM 50",
   title: "Walk In",
   details: ["First Timer get 30%", "Non-shareable"],
  },
  {
   price: "RM 160",
   title: "4 Classes",
   details: ["1 Month Validity", "Non-shareable"],
  },
  {
   price: "RM 250",
   title: "8 Classes",
   details: ["2 Month Validity", "Non-shareable"],
  },
 ];

 return (
  <section ref={sectionRef} className="py-24 px-6 bg-[#F3ECE6] text-[#444444]">
   <div className="max-w-5xl mx-auto text-center mb-12">
    <h3 className="font-serif text-3xl sm:text-4xl font-bold">
     Mat Pilates Plans
    </h3>
   </div>

   <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
    {plans.map((plan, index) => {
     const isHighlighted = index === plans.length - 1;

     return (
      <div
       key={index}
       className={`price-card relative border rounded-xl px-6 py-8 text-left shadow-sm hover:shadow-md transition duration-300 ${
        isHighlighted
         ? "bg-white/70 border-[#9B9B7B] shadow-lg scale-[1.03]"
         : "bg-white/50 border-[#DFD1C9]"
       }`}
      >
       {isHighlighted && (
        <div className="absolute font-bold -top-3 right-4 bg-[#9B9B7B] text-white text-xs px-2 py-1 rounded-full  shadow">
         Best Value
        </div>
       )}

       <h4 className="font-serif text-xl font-semibold mb-2">{plan.title}</h4>
       <p className="text-2xl font-sans font-bold mb-4 text-[#9B9B7B]">
        {plan.price}
       </p>
       <ul className="text-sm  text-[#716D64] space-y-1">
        {plan.details.map((line, i) => (
         <li key={i}>• {line}</li>
        ))}
       </ul>
      </div>
     );
    })}
   </div>
  </section>
 );
};

export default PriceSection;
