"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const ScheduleSection = () => {
 const sectionRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
  if (sectionRef.current) {
   gsap.fromTo(
    sectionRef.current.querySelectorAll(".schedule-card"),
    { y: 30, opacity: 0 },
    {
     y: 0,
     opacity: 1,
     duration: 1,
     ease: "circ.out",
     stagger: 0.15,
     scrollTrigger: {
      trigger: sectionRef.current,
      start: "top 90%",
      toggleActions: "play none none none",
     },
    }
   );
  }
 }, []);

 const schedule = [
  { day: "Sun", times: ["8:30 PM - 9:30 PM"] },
  { day: "Mon", times: ["9:00 AM - 10:00 AM"] },
  { day: "Wed", times: ["8:30 PM - 9:30 PM"] },
  { day: "Thu", times: ["9:00 AM - 10:00 AM"] },
  { day: "Fri", times: ["9:00 AM - 10:00 AM"] },
 ];

 return (
  <section
   id="Time"
   ref={sectionRef}
   className="py-28 px-6 bg-[#FAF8F6] text-[#444444]"
  >
   <div className="max-w-5xl mx-auto text-center mb-16">
    <h3 className="font-serif text-3xl sm:text-4xl font-bold">
     Weekly Schedule
    </h3>
   </div>
   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 max-w-6xl mx-auto text-center">
    {schedule.map(({ day, times }, idx) => (
     <div
      key={idx}
      className="schedule-card bg-white/60 backdrop-blur-md border border-[#E8DDD4] rounded-3xl text-center p-6 shadow-sm hover:shadow-md transition duration-300"
     >
      <h4 className="font-serif font-bold mb-3 text-[#9B9B7B] text-lg">
       {day}
      </h4>
      <ul className="text-base font-medium text-[#716D64] space-y-1">
       {times.map((time, i) => (
        <li key={i}>{time}</li>
       ))}
      </ul>
     </div>
    ))}
   </div>
  </section>
 );
};

export default ScheduleSection;
