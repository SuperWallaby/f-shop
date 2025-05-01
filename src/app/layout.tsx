import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Inter } from "next/font/google";
import { Playfair_Display } from "next/font/google";

const inter = Inter({
 subsets: ["latin"],
 variable: "--font-inter",
 display: "swap",
});

const playfair = Playfair_Display({
 subsets: ["latin"],
 weight: ["500", "700"],
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
   </body>
  </html>
 );
}

// app/layout.tsx 또는 app/page.tsx
export const metadata = {
 title: "Fasea – Pilates Studio for Wellness & Balance",
 description:
  "Fasea is your personal pilates space in KL. Strengthen your body and calm your mind with tailored sessions.",
 keywords: ["Pilates", "Wellness", "Fasea", "Balance", "KL Studio"],
 authors: [{ name: "Fasea Studio" }],
 creator: "Fasea Studio",
 openGraph: {
  title: "Fasea – Wellness & Balance",
  description: "Experience Pilates in the most elegant and calm space in KL.",
  url: "https://fasea.com", // 실제 도메인으로 변경
  siteName: "Fasea Pilates Studio",
  locale: "en_US",
  type: "website",
 },
 robots: {
  index: true,
  follow: true,
  googleBot: {
   index: true,
   follow: true,
  },
 },
 twitter: {
  card: "summary_large_image",
  title: "Fasea – Pilates Studio",
  description:
   "Your space to move with intention, strength, and calm. Book your first class today.",
  creator: "@fasea_studio", // 트위터 계정 있으면 넣기
 },
 icons: {
  icon: "/favicon.ico",
 },
};
