import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AuthProvider from "@/components/AuthProvider";
import WebContainerInitializer from "@/components/WebContainerInitializer";

const geist = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Code Generator",
  description: "Generate code projects with AI",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={geist.className}>
        <AuthProvider session={session}>
          <div className="min-h-screen bg-gray-50">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
