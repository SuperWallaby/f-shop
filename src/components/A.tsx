import RevealTrigger from "../hook/Reaveal";

const PriceSection = () => {
 const plans = [
  {
   strong: true,
   price: "RM 50",
   title: "Single Class",
   details: ["30% off for first-time visitors", "Non-shareable"],
  },
  {
   price: "RM 160",
   title: "4 Classes",
   details: ["1 Month Validity", "Non-shareable"],
  },
  {
   price: "RM 280",
   title: "8 Classes",
   details: ["2 Month Validity", "Non-shareable"],
  },
 ];

 const reformerPrivatePlans = [
  {
   price: "RM 170",
   title: "Single Class",
   details: ["First Timer get 10% off", "Non-shareable"],
  },
  {
   price: "RM 480",
   title: "3 Classes",
   details: ["1 Month Validity", "Non-shareable"],
  },
  {
   price: "RM 1,500",
   title: "10 Classes",
   details: ["3 Month Validity", "Non-shareable"],
  },
 ];
 return (
  <section id="Plan" className="py-24 px-6 bg-[#F3ECE6] text-[#444444]">
   <div className="max-w-5xl mx-auto text-center mb-20">
    <h3 className="font-serif text-xl sm:text-2xl   !tracking-widest">PLANS</h3>
   </div>
   <RevealTrigger rootSelector="#Plan" />
   <div className="text-3xl mb-12  flex-col justify-center items-center gap-4 mx-auto  flex sm:text-4xl font-bold">
    <svg
     className="w-16 h-16   grow-0"
     xmlns="http://www.w3.org/2000/svg"
     version="1.0"
     width="512.000000pt"
     height="512.000000pt"
     viewBox="0 0 512.000000 512.000000"
     preserveAspectRatio="xMidYMid meet"
    >
     <g
      transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)"
      fill="#000000"
      stroke="none"
     >
      <path
       fill="#444444"
       d="M3380 4193 c-39 -20 -65 -43 -88 -78 l-34 -50 -79 4 c-43 1 -102 -2 -131 -9 -202 -47 -359 -217 -389 -421 -15 -106 16 -293 65 -394 36 -72 103 -149 167 -192 l36 -24 -33 -76 c-49 -115 -58 -185 -50 -428 3 -130 2 -235 -5 -275 -10 -65 -61 -191 -85 -211 -10 -8 -50 17 -166 104 -270 202 -528 362 -954 590 -148 80 -170 95 -268 189 -77 75 -133 141 -204 242 -53 77 -109 148 -124 159 -95 70 -258 -13 -258 -133 0 -19 18 -129 39 -243 53 -279 77 -317 232 -368 80 -27 86 -31 302 -211 193 -160 213 -170 256 -124 16 17 22 33 19 57 -3 30 -20 48 -138 147 -74 62 -135 114 -135 116 0 1 19 24 43 51 l42 50 113 -59 c548 -289 1048 -622 1191 -796 101 -123 220 -197 391 -244 50 -13 104 -28 121 -33 l32 -8 -80 -108 -80 -107 -286 2 -286 3 -110 152 c-129 176 -210 274 -357 433 -148 159 -234 233 -270 233 -41 0 -69 -29 -69 -72 0 -33 11 -47 131 -166 160 -159 285 -302 402 -460 l89 -120 -1114 -5 c-1023 -5 -1116 -6 -1144 -22 -43 -23 -89 -79 -104 -123 -28 -86 18 -199 99 -242 l44 -23 2407 0 2407 0 44 23 c81 43 127 156 99 242 -16 47 -63 101 -111 126 -35 18 -61 19 -352 19 l-313 0 -17 103 c-18 117 -56 243 -98 332 -16 34 -95 168 -177 299 l-148 239 14 76 c20 112 19 331 -1 408 -42 161 -151 299 -294 373 l-42 21 29 46 c53 83 65 135 64 273 -1 92 -6 145 -21 200 l-21 74 43 41 c115 113 96 306 -39 390 -40 24 -62 30 -120 33 -63 3 -78 0 -126 -25z m179 -149 c40 -34 44 -98 8 -132 l-23 -22 -29 30 c-16 16 -46 42 -67 56 -45 32 -47 45 -12 73 37 29 85 27 123 -5z m-257 -156 c108 -50 177 -146 204 -285 16 -83 18 -201 5 -222 -6 -10 -34 7 -113 73 -92 74 -107 91 -118 129 -15 56 -60 112 -111 137 -47 24 -112 26 -232 4 -49 -8 -93 -14 -98 -12 -18 6 67 113 115 146 70 46 128 62 216 59 55 -3 91 -10 132 -29z m-178 -320 c7 -13 17 -36 21 -53 3 -16 18 -45 31 -62 20 -26 158 -145 243 -210 14 -10 14 -13 -2 -31 -10 -11 -46 -35 -80 -53 -53 -28 -74 -34 -147 -37 -109 -5 -177 19 -253 88 -77 70 -97 117 -131 307 -5 30 -3 33 27 38 152 28 188 33 229 34 39 1 50 -3 62 -21z m-2070 -509 c61 -88 131 -173 182 -222 l82 -81 -41 -46 -41 -46 -71 29 c-38 16 -84 35 -102 43 -18 7 -39 24 -47 37 -17 25 -89 394 -81 415 2 6 8 12 13 12 4 0 52 -64 106 -141z m2483 -49 c77 -38 166 -131 199 -207 28 -64 47 -210 36 -276 l-7 -37 -77 123 c-102 163 -149 197 -273 197 -110 0 -217 -77 -245 -178 -16 -57 -12 -133 10 -180 10 -23 99 -147 197 -274 98 -128 183 -239 190 -249 13 -18 -14 -61 -122 -198 l-50 -63 -56 6 c-84 10 -231 52 -297 85 -62 31 -127 81 -166 128 l-24 29 43 68 c89 137 107 240 99 541 -7 239 0 294 49 394 l23 46 95 2 c93 3 194 26 249 58 37 21 60 18 127 -15z m-48 -377 c37 -35 552 -863 598 -962 32 -68 88 -259 79 -268 -2 -2 -25 24 -51 59 -26 35 -57 71 -67 81 -27 23 -80 22 -103 -3 -32 -36 -23 -73 39 -154 l56 -76 -360 0 c-286 0 -360 3 -354 13 20 32 145 200 199 267 34 41 80 101 103 133 24 31 46 57 50 57 4 0 19 -18 34 -39 15 -21 39 -42 52 -45 59 -15 110 38 90 92 -6 15 -131 184 -277 376 -239 311 -267 352 -267 384 1 70 42 111 112 112 28 0 46 -7 67 -27z m1463 -1490 c22 -20 23 -51 1 -75 -15 -17 -103 -18 -2391 -18 -2196 0 -2377 1 -2394 17 -22 20 -23 51 -1 75 15 17 103 18 2391 18 2196 0 2377 -1 2394 -17z"
      />
     </g>
    </svg>
    <div className="font-serif">Group Mat Class</div>
    <p className="text-[#716D64] text-sm  text-center font-normal">
     A small group class focused on core strength, posture, and
     flexibility—great for all levels.
     <br /> Get personalized guidance in a fun, supportive setting.
    </p>
   </div>

   <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
    {plans.map((plan, index) => {
     const isHighlighted = index === plans.length - 1;

     return (
      <div
       id="Price"
       key={index}
       className={`reveal price-card relative border rounded-xl px-6 py-8 text-left shadow-sm hover:shadow-md transition duration-300 ${
        isHighlighted
         ? "bg-white/70 border-[#9B9B7B] shadow-lg scale-[1.03]"
         : "bg-white/50 border-[#DFD1C9]"
       }`}
      >
       {isHighlighted && (
        <div className="absolute font-bold -top-3 right-4 bg-[#9B9B7B] text-white text-xs px-2 py-1 rounded-full  shadow">
         Best Value
        </div>
       )}

       <h4 className="font-serif text-2xl font-bold mb-2">{plan.title}</h4>
       <p className="text-xl font-sans font-bold mb-4 text-[#9B9B7B]">
        {plan.price}
       </p>
       <ul className="text-sm  text-[#716D64] space-y-1">
        {plan.details.map((line, i) => (
         <li className={line.includes("30%") ? "font-semibold" : ""} key={i}>
          • {line}
         </li>
        ))}
       </ul>
      </div>
     );
    })}
   </div>

   <div className="text-3xl mb-12 mt-24 text-center  flex-col justify-center items-center gap-4 mx-auto  flex sm:text-4xl font-bold">
    <svg
     className="w-14 h-14   grow-0"
     xmlns="http://www.w3.org/2000/svg"
     version="1.0"
     width="512.000000pt"
     height="512.000000pt"
     viewBox="0 0 512.000000 512.000000"
     preserveAspectRatio="xMidYMid meet"
    >
     <g
      transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)"
      fill="#444444"
      stroke="none"
     >
      <path d="M3910 4685 c-152 -43 -257 -171 -268 -326 -2 -37 0 -88 7 -112 10 -42 9 -49 -30 -133 -88 -190 -106 -299 -71 -432 21 -81 24 -77 -53 -87 -75 -9 -240 -54 -325 -87 -186 -73 -306 -146 -528 -322 l-154 -120 -73 3 c-96 4 -173 -13 -263 -55 -86 -41 -197 -141 -233 -209 -21 -39 -31 -47 -74 -59 -27 -8 -341 -91 -696 -185 l-646 -170 -151 -3 -150 -3 -4 74 c-3 65 -6 76 -31 97 -38 33 -96 33 -134 0 l-28 -24 -3 -701 -2 -700 29 -33 c26 -30 34 -33 100 -36 l71 -4 0 -284 c0 -314 1 -322 62 -343 19 -7 122 -11 260 -11 188 0 234 3 259 16 55 28 59 55 59 354 l0 270 1710 0 1710 0 0 -285 0 -285 29 -32 29 -33 262 0 262 0 29 33 29 32 0 284 0 284 81 4 c77 3 82 5 110 36 l29 32 0 248 0 248 -28 45 c-16 24 -92 135 -170 247 -78 111 -142 204 -142 207 0 2 64 104 143 227 180 280 197 310 197 337 0 34 -26 76 -55 89 -57 26 -103 8 -146 -60 l-31 -49 -40 40 c-22 21 -183 162 -358 312 -283 244 -316 275 -297 283 172 69 262 147 331 291 89 181 112 302 82 429 -26 109 -77 194 -167 280 -54 51 -79 82 -79 98 0 39 -56 144 -100 188 -88 88 -233 127 -350 95z m139 -195 c73 -21 121 -94 121 -183 0 -54 13 -73 75 -108 95 -54 155 -138 170 -241 l7 -47 -78 34 c-142 61 -256 66 -369 16 l-45 -20 -67 30 c-37 17 -69 32 -71 34 -5 4 32 76 63 121 30 44 31 68 5 125 -46 103 -3 209 99 239 36 11 51 11 90 0z m-206 -729 c87 -39 113 -39 185 1 77 44 138 44 242 -1 41 -18 79 -37 83 -41 12 -11 -28 -85 -74 -135 -23 -25 -64 -54 -100 -70 -55 -24 -70 -27 -143 -23 -91 5 -141 26 -206 84 -47 43 -87 121 -96 187 -8 55 -17 55 109 -2z m-451 -433 c-10 -26 -16 -75 -16 -123 0 -66 4 -90 27 -140 33 -70 59 -100 144 -164 l61 -47 -25 -33 c-31 -39 -92 -68 -293 -139 -178 -63 -501 -164 -506 -159 -14 13 -153 402 -146 406 5 3 69 54 143 112 209 166 329 236 510 299 118 40 120 40 101 -12z m413 13 c47 -29 913 -779 925 -800 32 -61 -11 -146 -80 -157 -43 -7 -19 -23 -592 391 -233 169 -435 320 -450 337 -57 65 -41 175 31 224 45 30 121 33 166 5z m-1291 -677 c43 -113 74 -209 70 -213 -5 -5 -72 -34 -149 -66 -518 -213 -511 -211 -1260 -314 -280 -39 -520 -72 -532 -75 -23 -3 -23 -2 -23 108 l0 112 53 14 c295 74 1332 352 1347 360 12 6 32 35 46 65 63 131 183 213 319 214 l50 1 79 -206z m1614 -186 c191 -139 370 -261 399 -273 l51 -21 -152 -240 -152 -239 -645 -2 c-485 -2 -650 -6 -667 -15 -57 -30 -65 -113 -16 -159 l26 -24 974 -3 974 -2 0 -120 0 -120 -2360 0 -2360 0 0 120 0 120 976 2 976 3 29 33 c40 44 40 93 0 133 l-29 29 -801 0 -801 0 21 44 22 43 151 21 c83 12 300 42 481 67 492 68 529 73 670 107 170 40 272 76 592 209 172 71 340 133 480 175 289 87 507 165 631 225 85 41 108 57 134 94 18 25 36 45 41 45 4 0 164 -113 355 -252z m-3718 -448 c0 -139 -3 -166 -19 -199 -32 -63 -90 -107 -163 -125 l-28 -6 0 210 c0 167 3 217 15 240 19 36 25 38 118 39 l77 1 0 -160z m4407 -317 c4 -10 -29 -13 -152 -13 -122 0 -155 3 -149 13 4 6 26 41 49 77 23 36 54 84 69 108 l27 43 76 -108 c41 -59 78 -113 80 -120z m-4179 -870 l-3 -218 -117 -3 -118 -3 0 221 0 220 120 0 120 0 -2 -217z m4062 -3 l0 -220 -120 0 -120 0 0 220 0 220 120 0 120 0 0 -220z" />
      <path d="M2507 1689 c-22 -13 -47 -61 -47 -93 0 -14 13 -40 29 -58 24 -27 36 -33 71 -33 35 0 47 6 71 33 16 18 29 44 29 58 0 33 -25 81 -49 94 -25 13 -81 12 -104 -1z" />
     </g>
    </svg>
    <h3 className="font-serif">
     Reformer <span className="whitespace-nowrap">Private Class</span>
    </h3>
    <p className="text-[#716D64] text-sm font-normal">
     A fully customized session using the Pilates Reformer machine. <br /> Ideal
     for building strength, improving mobility, or working through injuries—at
     your pace.
    </p>
   </div>

   <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
    {reformerPrivatePlans.map((plan, index) => {
     const isHighlighted = index === plans.length - 1;

     return (
      <div
       id="Price"
       key={index}
       className={`reveal price-card relative border rounded-xl px-6 py-8 text-left shadow-sm hover:shadow-md transition duration-300 ${
        isHighlighted
         ? "bg-white/70 border-[#9B9B7B] shadow-lg scale-[1.03]"
         : "bg-white/50 border-[#DFD1C9]"
       }`}
      >
       {isHighlighted && (
        <div className="absolute font-bold -top-3 right-4 bg-[#9B9B7B] text-white text-xs px-2 py-1 rounded-full  shadow">
         Best Value
        </div>
       )}

       <h4 className="font-serif text-2xl font-bold mb-2">{plan.title}</h4>
       <p className="text-xl font-sans font-bold mb-4 text-[#9B9B7B]">
        {plan.price}
       </p>
       <ul className="text-sm  text-[#716D64] space-y-1">
        {plan.details.map((line, i) => (
         <li className={line.includes("30%") ? "font-semibold" : ""} key={i}>
          • {line}
         </li>
        ))}
       </ul>
      </div>
     );
    })}
   </div>
  </section>
 );
};

export default PriceSection;
