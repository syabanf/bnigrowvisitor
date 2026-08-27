import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import ToastProvider from "@/components/ui/ToastProvider";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Generic root metadata — per-chapter branding is applied client-side from the
// resolved tenant, so the static title stays chapter-neutral.
export const metadata: Metadata = {
  title: "BNI Visitor Management",
  applicationName: "BNI Visitor Management",
  description: "Visitor management dashboard for BNI chapters",
  appleWebApp: {
    capable: true,
    title: "BNI Visitor",
    // Lets the page paint under the status bar so the safe-area padding below
    // is what actually positions content.
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewport-fit=cover is what makes env(safe-area-inset-*) resolve to real
  // values on notched devices in standalone mode.
  viewportFit: "cover",
  themeColor: "#d9173b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <ToastProvider />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
