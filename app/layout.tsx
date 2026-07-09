import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dueldev.ru"),
  title: {
    default: "duel.dev — 1v1 coding duels",
    template: "%s · duel.dev",
  },
  description:
    "Challenge another developer to a 1v1 coding duel. Same problem, race against the clock — the fastest correct solution wins the pot. Free to play, 5,000 coins to start.",
  keywords: [
    "coding duel",
    "competitive programming",
    "code battle",
    "1v1 coding",
    "algorithm challenge",
    "leetcode duel",
    "developer game",
  ],
  icons: { icon: [{ url: "/favicon.ico" }, { url: "/favicon.svg", type: "image/svg+xml" }] },
  openGraph: {
    type: "website",
    url: "https://dueldev.ru",
    siteName: "duel.dev",
    title: "duel.dev — 1v1 coding duels",
    description:
      "Challenge another developer to a 1v1 coding duel. Fastest correct solution wins the pot. Free to play.",
  },
  twitter: {
    card: "summary_large_image",
    title: "duel.dev — 1v1 coding duels",
    description:
      "Challenge another developer to a 1v1 coding duel. Fastest correct solution wins the pot.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
