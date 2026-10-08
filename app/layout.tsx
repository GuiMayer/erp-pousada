import type { Metadata, Viewport } from 'next'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  description: 'Dashboard de gerenciamento de quartos',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#3a7d5c',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <div role="status" className="bg-amber-100 text-amber-950 px-4 py-2 text-center text-sm font-medium">
            Demonstração · Dados fictícios. As alterações serão descartadas ao encerrar este ambiente.
          </div>
        )}
        {children}
      </body>
    </html>
  )
}
