import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Apple-style typography: Inter with optical sizing & tabular numerals for finance
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PulsePay — Autonomous Receivables & Invoicing Assistant",
  description:
    "Autonomous, polite receivables recovery powered by PayPal Agent Toolkit and explainable AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--accent-tint)] selection:text-[var(--primary)]">
        {children}
      </body>
    </html>
  );
}
