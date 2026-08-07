import type { Metadata } from "next";
import { Inter } from "next/font/google";
import MotionProvider from "@/components/motion/MotionProvider";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

/**
 * Runs before first paint: applies the stored theme (or the dark default) so
 * there is never a flash of the wrong theme. Keeps the pre-revamp "theme"
 * localStorage key so returning users keep their choice.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}})();`;

export const metadata: Metadata = {
  metadataBase: new URL("https://autom8x.ai"),
  title: {
    default: site.name,
    template: `%s | ${site.name}`,
  },
  description: site.tagline,
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.variable} min-h-screen overflow-x-clip antialiased`}
      >
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
