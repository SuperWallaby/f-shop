// components/HeroSection.tsx

import React from "react";
import WhyChooseSection from "../components/WhyChooseSection";
import PriceSection from "../components/A";
import ScheduleSection from "../components/B";
import ContactSection from "../components/Contact";
import LocationSection from "../components/Map";
import RevealTrigger from "../hook/Reaveal";
import { NavButtons } from "../components/Navigate";

const HeroSection = () => {
 //  const heroRef = useRef<HTMLDivElement>(null);

 //  const [navSolid, setNavSolid] = useState(false);

 //  useEffect(() => {
 //   const handleScroll = () => {
 //    const scrolled = window.scrollY;
 //    setNavSolid(scrolled > window.innerHeight);
 //   };

 //   window.addEventListener("scroll", handleScroll);
 //   return () => window.removeEventListener("scroll", handleScroll);
 //  }, []);

 return (
  <div className="   text-[#444444] ">
   <RevealTrigger rootSelector="#Hero" />
   <div
    id="Hero"
    // ref={heroRef}
    className="min-h-[100svh]  justify-center overflow-x-hidden bg-hero-animated relative flex flex-col items-center  px-6 py-12 "
   >
    {/* Header / Navigation */}
    <nav className="fixed px-5 !bg-transparent md:px-0 top-5 z-50 w-full max-w-6xl flex justify-between items-center mb-12 duration-300  transition-none">
     <h1 className="text-2xl font-serif font-bold tracking-tight italic underline reveal transition-none">
      <a href="#Hero">Fasea</a>
     </h1>
     <NavButtons />
    </nav>

    {/* Hero Content */}
    <main className="!bg-transparent w-full max-w-screen mt-5   px-4  text-center flex flex-col items-center">
     <h2 className="font-serif text-4xl sm:text-5xl font-extrabold mb-6 leading-snug reveal transition-none">
      Your Personal <br /> Pilates Studio for Wellness & Balance
     </h2>
     <p className="text-lg sm:text-xl text-[#716D64] max-w-xl mb-8 reveal transition-none">
      Fasea is your space to strengthen your body and calm your mind. Start your
      journey today.
     </p>
     <a
      target="_blank"
      aria-label="Book Link"
      href="https://www.instagram.com/fasea.pilates"
      className="px-6 py-3 rounded-full text-white text-sm font-medium button-gradient button-shadow-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-[1.04] hover:brightness-110 hover:shadow-lg reveal transition-none"
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
