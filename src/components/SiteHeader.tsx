"use client";

import { NavButtons } from "./Navigate";

const SiteHeader = () => {
 return (
  <header className="fixed top-5 z-50 w-full flex justify-center pointer-events-none">
   <nav className="pointer-events-auto px-5 md:px-0 w-full max-w-6xl flex justify-between items-center mb-12">
    <a aria-label="Go to home" href="/" className="bg-transparent">
     <h1 className="text-2xl font-serif font-bold tracking-tight italic underline">
      Faséa
     </h1>
    </a>
    <NavButtons />
   </nav>
  </header>
 );
};

export default SiteHeader;


