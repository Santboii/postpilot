import type { Metadata } from "next";
import "./globals.css";
import { AppWrapper } from "@/components/layout/AppWrapper";

export const metadata: Metadata = {
  title: "SocialsGenie - AI-Powered Social Media",
  description: "Create, schedule, and publish AI-generated content across all your social media platforms.",
  keywords: ["social media", "AI", "scheduler", "cross-posting", "content creation", "automation"],
  authors: [{ name: "SocialsGenie" }],
  openGraph: {
    title: "SocialsGenie - AI-Powered Social Media",
    description: "Create, schedule, and publish AI-generated content across all your social media platforms.",
    type: "website",
    url: "https://socialsgenie.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  );
}
