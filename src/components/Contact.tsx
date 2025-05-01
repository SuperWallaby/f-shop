"use client";

import { FaInstagram, FaWhatsapp } from "react-icons/fa";

const ContactSection = () => {
 return (
  <section className="py-28 px-6 bg-[#DFD1C9] text-[#444444]">
   <div className="max-w-3xl mx-auto text-center">
    <h3 className="font-serif text-3xl sm:text-4xl font-bold mb-6">
     Get in Touch
    </h3>
    <p className="text-[#716D64] text-base sm:text-lg mb-10">
     We’d love to hear from you. Reach out on your favorite platform.
    </p>

    <div className="flex justify-center gap-6">
     <a
      href="https://www.instagram.com/fasea" // Replace with real link
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#9B9B7B] hover:text-[#D1B9B4] transition transform hover:scale-110 text-4xl"
     >
      <FaInstagram />
     </a>
     <a
      href="https://wa.me/60123456789" // Replace with real WhatsApp number
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#9B9B7B] hover:text-[#D1B9B4]  transition transform hover:scale-110 text-4xl"
     >
      <FaWhatsapp />
     </a>
    </div>
   </div>
  </section>
 );
};

export default ContactSection;
