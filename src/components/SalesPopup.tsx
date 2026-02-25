"use client";

import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

const WHATSAPP_URL = "https://wa.me/60145403560";
const WHATSAPP_MESSAGE = "Hi Fasea, i would like to grab this Ramadan Sales";
const WHATSAPP_LINK = `${WHATSAPP_URL}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

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

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsVisible(false);
    setTimeout(() => {
      setIsOpen(false);
      localStorage.setItem(
        "salesPopupLastShown",
        new Date().getTime().toString(),
      );
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
        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-lg cursor-pointer relative w-full aspect-auto sm:max-h-[85vh] rounded-lg overflow-hidden shadow-2xl block cursor-pointer"
          aria-label="Contact via WhatsApp for Ramadan Sales"
        >
          <img
            src="/promotion.png"
            alt="Promotion"
            className="object-contain w-full h-full"
          />
        </a>
      </div>
    </div>
  );
};

export default SalesPopup;
