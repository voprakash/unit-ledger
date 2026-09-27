import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Ledger",
  description: "Unit Ledger Management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#f5f6f8] text-gray-900 antialiased">{children}</body>
    </html>
  );
}
