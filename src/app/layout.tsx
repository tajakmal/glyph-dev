import type { Metadata } from "next";
import Script from "next/script";
import { Space_Grotesk, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Glyph — read fast, read slow",
  description:
    "Speed reading, one word at a time. Knowledge accessible to everyone.",
};

const themeScript = `
(() => {
  try {
    const storageKey = 'glyph:theme';
    const stored = localStorage.getItem(storageKey);
    // Glyph default is dark ("kinetic"). Paper is an opt-in mode.
    const theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${fraunces.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
