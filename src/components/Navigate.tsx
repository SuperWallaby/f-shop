"use client";

import { useEffect, useState } from "react";

const NAV_ITEMS = ["About", "Plan", "Contact"];

export const NavButtons = () => {
 const [navSolid, setNavSolid] = useState(false);

 useEffect(() => {
  const handleScroll = () => {
   setNavSolid(window.scrollY > window.innerHeight);
  };

  window.addEventListener("scroll", handleScroll);
  return () => window.removeEventListener("scroll", handleScroll);
 }, []);

 const handleClick = (id: string) => {
  if (id === "About") {
   window.location.href = "/about";
   return;
  }

  if (window.location.pathname !== "/") {
   window.location.href = `/#${id}`;
   return;
  }

  const el = document.getElementById(id);
  if (el) {
   el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
 };

 return (
  <div className="space-x-2 md:space-x-3">
   {NAV_ITEMS.map((item) => (
    <button
     key={item}
     onClick={() => handleClick(item)}
     className={`  px-4 py-2 text-sm font-medium rounded-full border border-[#DFD1C9] cursor-pointer text-[#444444] hover:bg-[#DFD1C9] transition ${
      navSolid ? "bg-white/90" : "!bg-transparent"
     }`}
    >
     {item}
    </button>
   ))}
  </div>
 );
};
