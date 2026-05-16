import type { Metadata } from "next";
import "./globals.css";
import SplashScreen from "@/components/ui/SplashScreen";

export const metadata: Metadata = {
  title: "Y-tech Bank — Banking for the next generation",
  description: "Premium digital banking powered by AI",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Nunito', sans-serif" }}>
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
