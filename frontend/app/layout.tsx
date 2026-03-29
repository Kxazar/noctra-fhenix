import type { Metadata } from 'next'
import { ReactNode } from 'react'

import { Providers } from '@/components/Providers'

import './globals.css'

export const metadata: Metadata = {
  title: 'VeilFlow',
  description: 'Confidential ve-tokenomics and shielded LP-backed stablecoin demo built on Fhenix CoFHE.',
}

type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
