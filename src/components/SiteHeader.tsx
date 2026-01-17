"use client";

import Link from "next/link";
import { NavButtons } from "./Navigate";

const SiteHeader = () => {
 return (
  <header className="fixed left-0 right-0  md:left-auto md:right-auto top-5 z-50 w-full flex justify-center pointer-events-none">
   <nav className="pointer-events-auto w-full max-w-6xl box-border px-6 flex justify-between items-center mb-12">
    <Link aria-label="Go to home" href="/" className="bg-transparent">
     <h1 className="text-2xl font-serif font-bold tracking-tight italic underline">
      Faséa
     </h1>
    </Link>
    <NavButtons />
   </nav>
  </header>
 );
};

export default SiteHeader;
