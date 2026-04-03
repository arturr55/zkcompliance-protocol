import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZKCompliance Protocol",
  description: "Private Payroll & Compliance on Aztec Network",
};

const navLinks = [
  { href: "/", label: "Overview", icon: "🏠" },
  { href: "/employer", label: "Employer", icon: "🏢" },
  { href: "/employee", label: "Employee", icon: "👤" },
  { href: "/oracle", label: "Compliance Oracle", icon: "⚖️" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-gray-950 text-gray-100">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="px-6 py-5 border-b border-gray-800">
            <div className="text-lg font-bold text-purple-400">ZKCompliance</div>
            <div className="text-xs text-gray-500 mt-0.5">Aztec Network · Private Payroll</div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <span className="text-base">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>
          <div className="px-6 py-4 border-t border-gray-800">
            <div className="text-xs text-gray-600">Aztec v4.1.3</div>
            <div className="text-xs text-gray-600">Noir · TXE Tested</div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
