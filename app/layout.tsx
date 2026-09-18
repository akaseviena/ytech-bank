import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import SplashScreen from "@/components/ui/SplashScreen";

export const metadata: Metadata = {
  title: "Y-tech — AI-native financial platform",
  description: "AI-native financial platform",
  icons: { icon: "/logo.PNG" },
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
        <Script src="https://tally.so/widgets/embed.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
