import type { Metadata } from "next";
import "./globals.css";
import RouteScaler from "@/components/RouteScaler";

export const metadata: Metadata = {
  title: "Identity Labs",
  description: "Analytics and intelligence tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <RouteScaler>
          {children}
        </RouteScaler>
      </body>
    </html>
  );
}
