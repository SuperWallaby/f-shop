// "use client";

// import { useEffect, useRef } from "react";
// import { Gsap } from "../utils/gasp";

// export const MainAnime = () => {
//  const heroRef = useRef<HTMLDivElement>(null);

//  useEffect(() => {
//   if (heroRef.current) {
//    const elements = heroRef.current.querySelectorAll("h1, h2, p, a, button");

//    Gsap.fromTo(
//     elements,
//     {
//      y: 50,
//      opacity: 0,
//     },
//     {
//      y: 0,
//      opacity: 1,
//      duration: 0.5,
//      ease: "power1.inOut",
//      stagger: 0.15,
//      clearProps: "opacity,transform",
//      scrollTrigger: {
//       trigger: heroRef.current,
//       start: "top 80%",
//       toggleActions: "play none none none",
//      },
//      onStart: () => {
//       elements.forEach((el) => {
//        el.classList.remove("opacity-0", "translate-y-12", "transition-none");
//       });
//      },
//     }
//    );
//   }
//  }, []);

//  return <div ref={heroRef} />; // 숨겨진 트리거용 div (필요시 부모로부터 ref 받을 수도 있음)
// };
