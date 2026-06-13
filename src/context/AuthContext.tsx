import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, Notification } from '../types'
import { requestPermission, subscribeToPush } from '../lib/notifications'

// [NOTIFY] Added notification fields and helpers to context type
interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  role: 'admin' | 'distributor' | null
  isAdmin: boolean
  isDistributor: boolean
  loading: boolean
  unreadNotifications: Notification[]
  markNotificationRead: (id: number) => void
  clearAllNotifications: () => void
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  role: null,
  isAdmin: false,
  isDistributor: false,
  loading: true,
  // [NOTIFY] Default values for notification fields
  unreadNotifications: [],
  markNotificationRead: () => {},
  clearAllNotifications: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // [NOTIFY] Single source of truth for unread notifications
  const [unreadNotifications, setUnreadNotifications] = useState<Notification[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setUnreadNotifications([])  // [NOTIFY] Clear on logout
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // [NOTIFY] Fetch unread notifications and set up ONE realtime channel when user is known
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    fetchUnreadNotifications(userId)

    const channel = supabase
      .channel('auth-context-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // New notification — add to unread list
          setUnreadNotifications((prev) => [payload.new as Notification, ...prev])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Notification marked as read — remove from unread list
          if ((payload.new as Notification).read) {
            setUnreadNotifications((prev) =>
              prev.filter((n) => n.notification_id !== (payload.new as Notification).notification_id)
            )
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session?.user?.id])

  async function fetchUnreadNotifications(userId: string) {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })

    if (data) setUnreadNotifications(data)
  }

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    setProfile(data)
    setLoading(false)

    if ('Notification' in window && Notification.permission === 'default') {
      const granted = await requestPermission()
      if (granted) await subscribeToPush()
    } else if (Notification.permission === 'granted') {
      await subscribeToPush().catch(() => {})
    }
  }

  // [NOTIFY] Mark a single notification as read locally (DB update handled in NotificationBell)
  function markNotificationRead(id: number) {
    setUnreadNotifications((prev) => prev.filter((n) => n.notification_id !== id))
  }

  // [NOTIFY] Clear all unread locally (DB update handled in NotificationBell)
  function clearAllNotifications() {
    setUnreadNotifications([])
  }

  const role = profile?.role ?? null

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      role,
      isAdmin: role === 'admin',
      isDistributor: role === 'distributor',
      loading,
      // [NOTIFY] Expose notification state and helpers
      unreadNotifications,
      markNotificationRead,
      clearAllNotifications,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)