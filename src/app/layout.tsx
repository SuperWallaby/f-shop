import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Inter } from "next/font/google";
import { Playfair_Display } from "next/font/google";
import Script from "next/script";
import SalesPopup from "../components/SalesPopup";

const inter = Inter({
 subsets: ["latin"],
 variable: "--font-inter",
 display: "swap",
});

const playfair = Playfair_Display({
 subsets: ["latin"],
 weight: ["700"],
 variable: "--font-playfair",
 display: "swap",
});

const geistSans = Geist({
 variable: "--font-geist-sans",
 subsets: ["latin"],
});

const geistMono = Geist_Mono({
 variable: "--font-geist-mono",
 subsets: ["latin"],
});

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 return (
  <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
   <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
    {children}
    {/* <SalesPopup /> */}
   </body>
   <Script
    async
    src="https://www.googletagmanager.com/gtag/js?id=AW-17771629817"
   />
   <Script id="gtag-aw-17771629817" strategy="afterInteractive">
    {`
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'AW-17771629817');
    `}
   </Script>
   <Script
    id="jsonld-localbusiness"
    type="application/ld+json"
    dangerouslySetInnerHTML={{
     __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "Faséa Pilates Studio",
      image: "https://fasea.com/og-image.jpg",
      url: "https://fasea.com",
      telephone: "+60145403560",
      address: {
       "@type": "PostalAddress",
       streetAddress:
        "Lot 32558 ( PT 30714 ), Taman Desa Wakaf Baru, Jalan Lapangan Terbang",
       addressLocality: "Kuala Terengganu",
       addressRegion: "Terengganu",
       postalCode: "21300",
       addressCountry: "MY",
      },
      geo: {
       "@type": "GeoCoordinates",
       latitude: 5.3830675, // 정확한 위도
       longitude: 103.0962731, // 정확한 경도
      },
      map: "https://www.google.com/maps?q=WOOD+BARBERSHOP,+Lot+32558+(+PT+30714+)+Taman+Desa+Wakaf+Baru,+Jalan+Lapangan+Terbang,+21300+Kuala+Terengganu,+Terengganu&ftid=0x31b7bdfe07fff745:0xd0218b296f852ad7",
      openingHours: "Mo-Fr 09:00-18:00",
      priceRange: "$$",
      sameAs: ["https://www.instagram.com/fasea", "https://wa.me/60145403560"],
     }),
    }}
   />
  </html>
 );
}
export const metadata = {
 title: "Faséa – Pilates Studio for Wellness & Balance",
 description:
  "Faséa is your personal pilates space in TRG. Strengthen your body and calm your mind with tailored sessions.",
 keywords: ["Pilates", "Wellness", "Faséa", "Balance", "KL Studio"],
 authors: [{ name: "Faséa Studio" }],
 creator: "Faséa Studio",
 openGraph: {
  title: "Faséa – Wellness & Balance",
  description: "Experience Pilates in the most elegant and calm space in TRG.",
  url: "https://fasea.com", // 도메인에 맞게 변경
  siteName: "Faséa Pilates Studio",
  locale: "en_US",
  type: "website",
  images: [
   {
    url: "/og-image.jpg", // public 폴더에 위치한 이미지
    width: 1200,
    height: 630,
    alt: "Faséa Pilates Studio",
   },
  ],
 },
 robots: {
  index: true,
  follow: true,
  googleBot: {
   index: true,
   follow: true,
  },
 },
 themeColor: "#DFD1C9",
 twitter: {
  card: "summary_large_image",
  title: "Faséa – Pilates Studio",
  description:
   "Your space to move with intention, strength, and calm. Book your first class today.",
  images: ["/og-image.jpg"],
  creator: "@fasea_studio", // 있다면 입력
 },
 icons: {
  icon: "/favicon.ico", // 여전히 .ico 권장
 },
};
