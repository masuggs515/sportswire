'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import SettingsSheet from './SettingsSheet'

export default function NavBar() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const pathname = usePathname()

  const navLink = (href: string, label: string) => {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return (
      <Link
        href={href}
        className={`text-sm font-semibold transition-colors ${
          active ? 'text-white' : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-gray-900 border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/" className="text-white font-bold text-xl tracking-tight mr-2">
            Mint Street Sports
          </Link>

          {navLink('/', 'Feed')}
          {navLink('/scores', 'Scores')}

          <div className="ml-auto">
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
