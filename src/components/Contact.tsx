import { FaInstagram } from "@react-icons/all-files/fa/FaInstagram";
import { FaWhatsapp } from "@react-icons/all-files/fa/FaWhatsapp";
import RevealTrigger from "../hook/Reaveal";
const ContactSection = () => {
 return (
  <section id="Contact" className="py-28 px-6 bg-[#EFE9E2] text-[#444444]">
   <RevealTrigger rootSelector="#Contact"></RevealTrigger>
   <div className="max-w-3xl mx-auto text-center">
    <h3 className="font-serif text-3xl sm:text-4xl font-bold mb-6">
     Get in Touch
    </h3>
    <p className="reveal text-[#5C574F] text-base sm:text-lg mb-10">
     We’d love to hear from you. Reach out on your favorite platform.
    </p>

    <div className="flex justify-center gap-6">
     <a
      aria-label="Insta link"
      href="https://www.instagram.com/fasea.pilates?igsh=MTZ5d2N0OHNibnc3aA%3D%3D&utm_source=qr" // Replace with real link
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#9B9B7B] reveal hover:text-[#D1B9B4] transition transform hover:scale-110 text-4xl"
     >
      <FaInstagram />
     </a>

     {/* +60145403560 */}
     <a
      aria-label="What's app link"
      href="https://wa.me/60145403560" // Replace with real WhatsApp number
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#9B9B7B] reveal hover:text-[#D1B9B4]  transition transform hover:scale-110 text-4xl"
     >
      <FaWhatsapp />
     </a>
    </div>
   </div>
  </section>
 );
};

export default ContactSection;
