import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Inviteting",
  description: "Gestión de invitados y escáner de entradas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${plusJakarta.variable} h-full antialiased`}>
      <body className="flex min-h-dvh w-full flex-col bg-[#f5f5f6] font-sans text-[#18181b]">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
