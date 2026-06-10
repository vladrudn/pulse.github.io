import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulse · Грошова допомога на оздоровлення",
  description: "Тестове робоче місце для опрацювання грошової допомоги на оздоровлення",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
