import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError(null)

    let emailToUse = identifier.trim()

    // If it looks like a phone number, look up email from distributors
    const isPhone = /^[0-9+\s\-()]{7,15}$/.test(emailToUse)
    if (isPhone) {
      const { data } = await supabase
        .from('distributors')
        .select('poc_email')
        .eq('poc_contact', emailToUse)
        .maybeSingle()

      if (!data) {
        setError('No account found with this phone number')
        setLoading(false)
        return
      }
      emailToUse = data.poc_email
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    })

    if (error) { setError(error.message); setLoading(false) }
    else { window.location.href = '/' }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-sm w-full max-w-sm">

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#eb2030]">Oh!G</h1>
          <p className="text-sm text-gray-500 mt-1">Inventory Management System</p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Email or Phone</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eb2030]"
              placeholder="you@example.com or 9876543210"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eb2030]"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-[#eb2030] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c4001a] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

      </div>
    </div>
  )
}