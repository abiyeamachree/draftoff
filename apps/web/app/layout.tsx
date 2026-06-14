import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DraftOff",
  description: "Multiplayer football draft — draft legends, simulate glory.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto min-h-screen max-w-6xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
