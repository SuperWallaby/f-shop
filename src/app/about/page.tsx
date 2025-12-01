import React from "react";
import RevealTrigger from "../../hook/Reaveal";
import SiteHeader from "../../components/SiteHeader";
import Image from "next/image";
import InstaCtaButton from "../../components/InstaCtaButton";

export const metadata = {
 title: "About Faséa – Story & Professional Pilates Approach",
 description:
  "Learn how Faséa was founded, Fasha's journey from sports taekwondo athlete and coach to certified Pilates instructor in Kuala Lumpur, and how professional corrective Pilates is practiced at the studio.",
};

const AboutPage = () => {
 return (
  <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
   <SiteHeader />
   <RevealTrigger rootSelector="#AboutFaseaPage" />
   <main id="AboutFaseaPage" className="max-w-5xl mx-auto space-y-20 mt-16">
    <section>
     <h1 className="font-serif text-3xl sm:text-4xl font-bold mb-4">
      Learn more about Faséa
     </h1>
     <p className="text-[#716D64] text-base sm:text-lg max-w-2xl">
      Faséa was created as a calm, focused space for people who want to move
      with more awareness, strength, and grace in their daily lives.
     </p>
    </section>

    <section className="grid gap-10 md:grid-cols-2 items-start">
     <div>
      <h2 className="font-serif text-2xl font-semibold mb-3">
       How Faséa began
      </h2>
      <p className="text-sm sm:text-base leading-relaxed text-[#5C574F]">
       Faséa started from a simple question: how can movement feel both deeply
       effective and genuinely enjoyable? The studio was founded to offer small,
       attentive classes where every detail—from breathing to alignment—is
       considered with care.
      </p>
     </div>
     <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
      <h3 className="font-serif text-xl font-semibold mb-2">
       About the instructor, Fasha
      </h3>
      <p className="text-sm sm:text-base leading-relaxed text-[#5C574F]">
       Fasha first built her body awareness as a{" "}
       <span className="font-semibold text-[#A66A4A]">
        sports taekwondo athlete
       </span>{" "}
       and later worked as a{" "}
       <span className="font-semibold text-[#A66A4A]">sports coach</span>.
       Through years of training and coaching, she saw how the right movement
       can completely change the way a body feels and functions.
       <br />
       <br />
       Drawn to the precision and intelligence of Pilates, she decided to become
       a certified Pilates instructor. She completed{" "}
       <span className="font-semibold text-[#A66A4A]">
        professional Pilates training in Kuala Lumpur
       </span>{" "}
       and holds formal certification, bringing both athletic discipline and
       careful, supportive guidance into every class.
      </p>
     </div>
    </section>

    <section>
     <h2 className="font-serif text-2xl font-semibold mb-3">
      Certification & training
     </h2>
     <p className="text-sm sm:text-base leading-relaxed text-[#5C574F] max-w-3xl mb-8">
      Faséa&apos;s practice is supported by formal Pilates education. Fasha
      completed a professional course in Kuala Lumpur and holds certification
      that reflects both technical knowledge and a commitment to safe, effective
      movement.
     </p>
     <div className="grid gap-8 sm:grid-cols-2 max-w-3xl items-start">
      <div>
       <p className="text-sm sm:text-base leading-relaxed text-[#5C574F]">
        This certification represents structured study in Pilates technique,
        anatomy, and safe programming. It allows Faséa to guide clients with
        confidence, especially when working with posture issues, old injuries,
        or everyday pain.
       </p>
      </div>
      <div className="bg-white/80 border border-[#E8DDD4] rounded-3xl p-4 flex flex-col justify-between">
       <div className="mb-3 relative aspect-square w-full rounded-2xl overflow-hidden bg-[#F3ECE6]">
        <Image
         src="/imgs/cert.webp"
         alt="Pilates instructor certification for Fasha completed in Kuala Lumpur"
         fill
         sizes="(min-width: 768px) 320px, 100vw"
         className="object-cover"
        />
       </div>
       <p className="text-xs sm:text-sm text-[#5C574F]">
        Official Pilates certification earned in Kuala Lumpur, displayed at the
        studio.
       </p>
      </div>
     </div>
    </section>

    <section>
     <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-4">
      Professional, corrective Pilates
     </h2>
     <p className="text-sm sm:text-base leading-relaxed text-[#5C574F] max-w-3xl mb-10">
      Pilates at Faséa is not just about following a routine. It is grounded in{" "}
      <span className="font-semibold text-[#A66A4A]">
       human body analysis and corrective movement
      </span>
      . Each client&apos;s posture, movement pattern, and areas of discomfort
      are observed carefully, so that exercises can be chosen to guide the body
      toward better alignment and balance.
      <br />
      <br />
      With this approach, clients are not only moving—they are learning how
      their bodies work, and how to support them for the long term.
     </p>

     <div className="grid gap-6 md:grid-cols-3">
      <div className="bg-white/80 border border-[#E8DDD4] rounded-3xl p-4 flex flex-col justify-between">
       <div className="mb-3 relative aspect-square w-full rounded-2xl overflow-hidden bg-[#F3ECE6]">
        <Image
         src="/imgs/anal-1.webp"
         alt="Posture analysis before and after at Faséa Pilates"
         fill
         sizes="(min-width: 768px) 220px, 100vw"
         className="object-cover"
        />
       </div>
       <p className="text-xs sm:text-sm text-[#5C574F]">
        Posture assessment to identify spine curves and overall alignment.”
       </p>
      </div>
      <div className="bg-white/80 border border-[#E8DDD4] rounded-3xl p-4 flex flex-col justify-between">
       <div className="mb-3 relative aspect-square w-full rounded-2xl overflow-hidden bg-[#F3ECE6]">
        <Image
         src="/imgs/anal-2.webp"
         alt="Core activation and strengthening progress for Faséa clients"
         fill
         sizes="(min-width: 768px) 220px, 100vw"
         className="object-cover"
        />
       </div>
       <p className="text-xs sm:text-sm text-[#5C574F]">
        Detailed alignment check from head to ankle to understand imbalances.
       </p>
      </div>
      <div className="bg-white/80 border border-[#E8DDD4] rounded-3xl p-4 flex flex-col justify-between">
       <div className="mb-3 relative aspect-square w-full rounded-2xl overflow-hidden bg-[#F3ECE6]">
        <Image
         src="/imgs/anal-3.webp"
         alt="Mobility improvement and movement quality changes at Faséa"
         fill
         sizes="(min-width: 768px) 220px, 100vw"
         className="object-cover"
        />
       </div>
       <p className="text-xs sm:text-sm text-[#5C574F]">
        Front-view symmetry assessment to spot left–right imbalances.
       </p>
      </div>
     </div>
    </section>

    <section className="py-16 px-6 bg-[#F8F0EE] text-center rounded-3xl">
     <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-4">
      Ready to explore Pilates with Faséa?
     </h2>
     <p className="text-[#716D64] text-sm sm:text-base mb-8 max-w-xl mx-auto">
      If you feel ready to start correcting your posture, strengthening your
      core, and moving with more ease, we would love to meet you in the studio.
     </p>
     <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
      <InstaCtaButton
       ariaLabel="Book Link"
       source="about_footer"
       className="px-6 py-3 rounded-full text-white font-medium button-gradient button-shadow-md hover:opacity-90 transition"
      >
       Book your first class
      </InstaCtaButton>
      <a
       href="/#About"
       aria-label="Back to main page About section"
       className="px-6 py-3 rounded-full text-sm font-medium text-[#444444] bg-white shadow-sm hover:shadow-md transition"
      >
       Back to main page
      </a>
     </div>
    </section>
   </main>
  </div>
 );
};

export default AboutPage;
