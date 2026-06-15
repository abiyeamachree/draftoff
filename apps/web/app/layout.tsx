import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Draft",
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
        <header className="border-b-2 border-black/40 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="title text-base text-gold">
              DRAFTOFF
            </Link>
            <span className="pill bg-black/40 text-white/70">Football Draft</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="title pb-8 pt-2 text-center text-[0.6rem] leading-relaxed text-white/40">
          Draft the team of your dreams
        </footer>
      </body>
    </html>
  );
}
