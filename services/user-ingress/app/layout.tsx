import type { CSSProperties } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
});

const bodyStyle = {
  "--font-sans": `${inter.style.fontFamily}, "SF Pro Display", "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`,
  "--font-mono": `${jetbrainsMono.style.fontFamily}, "JetBrains Mono", "SF Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace`,
} as CSSProperties;

export const metadata = {
  title: "Sign in",
  description: "Sign in and manage your account",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={bodyStyle}>
        {children}
      </body>
    </html>
  );
}
