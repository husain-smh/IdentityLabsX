import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { PaperBackground } from "@/components/PaperBackground";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Quote Tweet Analytics | Identity Labs",
  description: "Reverse-engineer viral content performance. Advanced quote tweet analytics with precision-grade metrics that reveal true social impact.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${playfair.variable} antialiased`}
      >
        <PaperBackground>{children}</PaperBackground>
      </body>
    </html>
  );
}
