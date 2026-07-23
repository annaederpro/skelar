import type { Metadata } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "coralQ",
  description: "Бережний таск-менеджер, що росте разом із тобою",
  appleWebApp: {
    title: "coralQ",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      className={`${nunitoSans.variable} ${fraunces.variable} h-dvh antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
