import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import { ModeScript } from "@/app/components/entrepta/mode-toggle";
import "./globals.css";

// Three families, loaded through next/font so they are self-hosted,
// preloaded and swapped rather than fetched by a render-blocking
// @import inside globals.css.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "nomatch · why didn't this document show up?",
  description:
    "Run one search under two tokenizer configurations, side by side, and find out which analysis stage dropped the document that should have come back. Runs entirely in the browser.",
  openGraph: {
    title: "nomatch",
    description: "Why didn't this document show up in my search?",
    type: "website",
  },
};

export const viewport: Viewport = {
  // Dark first, but the mode toggle can switch, so the document declares both.
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // ModeScript writes data-mode on this element before React hydrates,
      // which is the whole point of it: the alternative is a frame of the
      // wrong mode on every load. The attribute is the only difference.
      suppressHydrationWarning
      className={`${newsreader.variable} ${jetbrainsMono.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the stored mode before first paint. Without it, a person
            who chose light gets a frame of dark on every navigation. */}
        <ModeScript storageKey="nomatch" />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
