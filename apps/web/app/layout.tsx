import type { Metadata } from "next";
import { DraftOffBanner } from "@/components/DraftOffBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "DraftOff",
  description: "Pick 11 players and simulate a tournament!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-banner-wrap">
          <DraftOffBanner />
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="title pb-8 pt-2 text-center text-[0.6rem] leading-relaxed text-white/40">
          Draft the team of your dreams
        </footer>
      </body>
    </html>
  );
}
