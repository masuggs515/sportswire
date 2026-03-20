'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import AuthModal from './AuthModal'
import OnboardingOverlay from './OnboardingOverlay'

interface AuthButtonProps {
  onOpenSettings: () => void
}

export default function AuthButton({ onOpenSettings }: AuthButtonProps) {
  const [user, setUser] = useState<User | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Sync auth state on mount and on change
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))

    return () => subscription.unsubscribe()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleAuthSuccess = async (isNewUser: boolean) => {
    setShowModal(false)

    if (isNewUser) {
      // New signup — always show onboarding
      setShowOnboarding(true)
      return
    }

    // Existing user sign-in — check if they've done onboarding
    const supabase = createClient()
    const { data: { user: u } } = await supabase.auth.getUser()
    if (u) {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('user_id', u.id)
        .maybeSingle()

      if (!prefs) {
        setShowOnboarding(true)
        return
      }
    }

    router.refresh()
  }

  const handleOnboardingDone = () => {
    setShowOnboarding(false)
    router.refresh()
  }

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setShowDropdown(false)
    router.refresh()
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? ''

  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="text-sm text-gray-400 hover:text-white transition-colors font-medium"
        >
          Sign in
        </button>
        {showModal && (
          <AuthModal onClose={() => setShowModal(false)} onSuccess={handleAuthSuccess} />
        )}
      </>
    )
  }

  return (
    <>
      {showOnboarding && <OnboardingOverlay onDone={handleOnboardingDone} />}

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(v => !v)}
          className="w-8 h-8 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white transition-colors"
          aria-label="Account menu"
        >
          {initials}
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-44 bg-gray-800 rounded-xl border border-gray-700 shadow-xl py-1 z-50">
            <button
              onClick={() => { setShowDropdown(false); onOpenSettings() }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
            >
              Favorite Teams
            </button>
            <div className="my-1 border-t border-gray-700" />
            <button
              onClick={signOut}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </>
  )
}
