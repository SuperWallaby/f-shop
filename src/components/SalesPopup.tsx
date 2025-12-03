"use client";

import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

const SalesPopup = () => {
 const [isOpen, setIsOpen] = useState(false);
 const [isVisible, setIsVisible] = useState(false);

 useEffect(() => {
  const checkAndShowPopup = () => {
   const lastShown = localStorage.getItem("salesPopupLastShown");
   const now = new Date().getTime();
   const oneDay = 24 * 60 * 60 * 1000;

   if (!lastShown || now - parseInt(lastShown) > oneDay) {
    setIsOpen(true);
    setTimeout(() => {
     setIsVisible(true);
    }, 10);
   }
  };

  checkAndShowPopup();
 }, []);

 const handleClose = () => {
  setIsVisible(false);
  setTimeout(() => {
   setIsOpen(false);
   localStorage.setItem("salesPopupLastShown", new Date().getTime().toString());
  }, 300);
 };

 if (!isOpen) {
  return null;
 }

 return (
  <div
   className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-800 ${
    isVisible ? "opacity-100" : "opacity-0"
   }`}
  >
   <div
    className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-800 ${
     isVisible ? "opacity-100" : "opacity-0"
    }`}
    onClick={handleClose}
    aria-hidden="true"
   />
   <div
    className={`relative z-10 max-w-4xl w-full max-h-[90vh] flex items-center justify-center transition-all duration-300 ${
     isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
    }`}
   >
    <button
     onClick={handleClose}
     className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors z-20"
     aria-label="Close popup"
    >
     <XMarkIcon className="h-8 w-8 sm:h-10 sm:w-10" />
    </button>
    <div className="max-w-lg relative w-full aspect-auto sm:max-h-[85vh] rounded-lg overflow-hidden shadow-2xl">
     <img
      src="/imgs/sales.webp"
      alt="Special offer"
      className="object-contain "
     />
    </div>
   </div>
  </div>
 );
};

export default SalesPopup;
