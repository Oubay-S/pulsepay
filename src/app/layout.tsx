import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Apple-style typography: Inter with optical sizing & tabular numerals for finance
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
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
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-[var(--pp-bg)] text-[var(--pp-ink)] selection:bg-[var(--pp-lime-soft)] selection:text-[var(--pp-primary)]">
        {children}
      </body>
    </html>
  );
}
