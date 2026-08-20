import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chief of Staff — Automation Control Center",
  description: "Every workflow, one system."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
