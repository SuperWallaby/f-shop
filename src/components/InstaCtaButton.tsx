"use client";

import React from "react";
import { trackLeadClick } from "../utils/trackConversion";

type InstaCtaButtonProps = {
 ariaLabel: string;
 className?: string;
 source?: string;
 children: React.ReactNode;
};

const INSTAGRAM_URL = "https://www.instagram.com/fasea.pilates";

const InstaCtaButton = ({
 ariaLabel,
 className,
 source,
 children,
}: InstaCtaButtonProps) => {
 const handleClick = () => {
  trackLeadClick("instagram", source);
 };

 return (
  <a
   target="_blank"
   rel="noopener noreferrer"
   aria-label={ariaLabel}
   href={INSTAGRAM_URL}
   onClick={handleClick}
   className={className}
  >
   {children}
  </a>
 );
};

export default InstaCtaButton;
