"use client";

const LocationSection = () => {
 return (
  <section className="py-28 px-6 bg-[#FAF8F6] text-[#444444]">
   <div className="max-w-4xl mx-auto text-center mb-12">
    <h3 className="font-serif text-3xl sm:text-4xl font-bold mb-4">
     Visit Our Studio
    </h3>
    <p className="text-[#716D64]  text-base sm:text-lg">
     Lot 32558 ( PT 30714 ) Taman Desa Wakaf Baru, Jalan Lapangan Terbang, 21300
     Kuala Terengganu, Terengganu, Malaysia
    </p>
   </div>

   <div className="max-w-4xl mx-auto rounded-xl overflow-hidden shadow-lg mb-10">
    <iframe
     aria-label="Shop Location"
     className="w-full h-80 sm:h-96"
     src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3972.3404649017766!2d103.0889699!3d5.3649269!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31b7bd3c0e1a9f83%3A0xd53c97fab5b07c57!2sFas%C3%A9a%20Pilates!5e0!3m2!1sen!2skr!4v1746114141701!5m2!1sen!2skr" // 실제 주소로 바꿔주세요
     loading="lazy"
     referrerPolicy="no-referrer-when-downgrade"
    ></iframe>
   </div>

   <div className="text-center">
    <a
     aria-label="Map Link"
     href="https://maps.app.goo.gl/kaEBWU6ihJ4D5VD5A" // 실제 구글맵 링크로 바꾸기
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
