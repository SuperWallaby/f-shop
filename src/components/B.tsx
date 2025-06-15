import RevealTrigger from "../hook/Reaveal";

const ScheduleSection = () => {
 const schedule = [
  { day: "Sun", times: ["8:30 PM - 9:30 PM"] },
  { day: "Mon", times: ["9:00 AM - 10:00 AM"] },
  { day: "Wed", times: ["8:30 PM - 9:30 PM"] },
  { day: "Thu", times: ["9:00 AM - 10:00 AM"] },
  { day: "Fri", times: ["9:00 AM - 10:00 AM"] },
 ];

 return (
  <section id="Time" className="py-28 px-6 bg-[#FAF8F6] text-[#444444]">
   <RevealTrigger rootSelector="#Time" />
   <div className="max-w-5xl mx-auto text-center mb-16">
    <h3 className="font-serif mb-3 leading-snug text-3xl sm:text-4xl font-bold">
     Group Class <span className="whitespace-nowrap">Weekly Schedule</span>
    </h3>
    <p className="reveal text-[#5C574F] text-base sm:text-lg mb-10">
     Private Class Schedule is flexible between 10am - 6pmFv
    </p>
   </div>
   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 max-w-6xl mx-auto text-center">
    {schedule.map(({ day, times }, idx) => (
     <div
      key={idx}
      className="reveal schedule-card bg-white/60 backdrop-blur-md border border-[#E8DDD4] rounded-3xl text-center p-6 shadow-sm hover:shadow-md transition duration-300"
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
   <div className="mx-auto flex justify-center mt-8">
    <a
     target="_blank"
     href="https://burly-elbow-f4a.notion.site/213cbfc9f2c980ddaa4ee6b27de0487c?v=213cbfc9f2c9808db0eb000c2d99dea2&t=new"
     className="cursor-pointer underline underline-offset-2"
    >
     Check Detail Schdule
    </a>
   </div>
  </section>
 );
};

export default ScheduleSection;
