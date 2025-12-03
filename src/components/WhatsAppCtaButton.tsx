"use client";

import React from "react";
import { FaWhatsapp } from "@react-icons/all-files/fa/FaWhatsapp";
import { trackLeadClick } from "../utils/trackConversion";

type WhatsAppCtaButtonProps = {
 ariaLabel: string;
 className?: string;
 source?: string;
 children: React.ReactNode;
};

const WHATSAPP_URL = "https://wa.me/60145403560";

const WhatsAppCtaButton = ({
 ariaLabel,
 className,
 source,
 children,
}: WhatsAppCtaButtonProps) => {
 const handleClick = () => {
  trackLeadClick("whatsapp", source);
 };

 return (
  <a
   target="_blank"
   rel="noopener noreferrer"
   aria-label={ariaLabel}
   href={WHATSAPP_URL}
   onClick={handleClick}
   className={className}
  >
   {children}
  </a>
 );
};

export default WhatsAppCtaButton;

