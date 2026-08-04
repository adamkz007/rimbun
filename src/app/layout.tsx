import type { Metadata } from "next";
import { Geist_Mono, Work_Sans } from "next/font/google";
import { assertRequiredEnv } from "@/lib/env";
import "./globals.css";

assertRequiredEnv();

const workSans = Work_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rimbun — Clinic OS",
  description:
    "Calm, modern clinic management for general practice teams, with a clerking workspace built for real consultations.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
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
      className={`${workSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
