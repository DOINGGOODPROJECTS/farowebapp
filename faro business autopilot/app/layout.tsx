import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faro Business Autopilot",
  description: "Automation control panel for Faro — n8n workflows backed by Supabase.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
