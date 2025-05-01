"use client";

const LocationSection = () => {
 return (
  <section className="py-28 px-6 bg-[#FAF8F6] text-[#444444]">
   <div className="max-w-4xl mx-auto text-center mb-12">
    <h3 className="font-serif text-3xl sm:text-4xl font-bold mb-4">
     Visit Our Studio
    </h3>
    <p className="text-[#716D64]  text-base sm:text-lg">
     Fasea Pilates Studio, 2nd Floor, Jalan Wellness 9,
     <br />
     Kuala Lumpur, Malaysia
    </p>
   </div>

   <div className="max-w-4xl mx-auto rounded-xl overflow-hidden shadow-lg mb-10">
    <iframe
     className="w-full h-80 sm:h-96"
     src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3972.3408275535485!2d103.09156619999999!3d5.3648712!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31b7bdfe07fff745%3A0xd0218b296f852ad7!2sWOOD%20BARBERSHOP!5e0!3m2!1sen!2skr!4v1746105950167!5m2!1sen!2skr" // 실제 주소로 바꿔주세요
     loading="lazy"
     referrerPolicy="no-referrer-when-downgrade"
    ></iframe>
   </div>

   <div className="text-center">
    <a
     href="https://maps.app.goo.gl/dhBfgpz2GXFbt2VL6?g_st=com.google.maps.preview.copy" // 실제 구글맵 링크로 바꾸기
     target="_blank"
     rel="noopener noreferrer"
     className="inline-block button-gradient  text-white font-medium py-3 px-6 rounded-full shadow-md hover:opacity-90 transition"
    >
     Open in Google Maps
    </a>
   </div>
  </section>
 );
};

export default LocationSection;
