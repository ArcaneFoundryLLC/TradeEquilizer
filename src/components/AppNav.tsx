'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/trade', label: 'Trade' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/wants', label: 'Want List' },
  { href: '/dashboard', label: 'Dashboard', authRequired: true },
]

export function AppNav() {
  const pathname = usePathname()
  const { user, loading, signOut } = useAuth()
  
  return (
    <header className="bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            TradeEqualizer
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden gap-6 sm:flex">
            {navItems.map((item) => {
              // Hide auth-required items when not logged in
              if (item.authRequired && !user) return null
              
              const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Mobile Menu & Auth Controls */}
          <div className="flex items-center space-x-4">
            {/* Mobile Navigation Menu */}
            <div className="sm:hidden">
              <select 
                className="text-sm border rounded px-2 py-1"
                onChange={(e) => {
                  if (e.target.value) {
                    window.location.href = e.target.value
                  }
                }}
                value=""
              >
                <option value="">Menu</option>
                {navItems.map((item) => {
                  if (item.authRequired && !user) return null
                  return (
                    <option key={item.href} value={item.href}>
                      {item.label}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Auth Controls */}
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            ) : user ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 hidden sm:block">
                  {user.email}
                </span>
                <button
                  onClick={signOut}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="text-sm bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default AppNav


