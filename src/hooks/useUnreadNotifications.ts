import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Notification } from '../types'

export function useUnreadNotifications() {
  const { user } = useAuth()
  const [unreadNotifications, setUnreadNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (!user) return
    fetchUnread()

    const channel = supabase
      .channel('unread-notifications-${user.id}')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refetch on any change (INSERT or UPDATE to read=true)
          fetchUnread()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function fetchUnread() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user!.id)
      .eq('read', false)

    if (data) setUnreadNotifications(data)
  }

  // Returns a set of URL path prefixes that have unread notifications
  // e.g. if url is '/admin/orders/123', it will match '/admin/orders'
  function getUnreadPaths(): Set<string> {
    const paths = new Set<string>()
    unreadNotifications.forEach((n) => {
      if (n.url) paths.add(n.url)
    })
    return paths
  }

  return {
    unreadNotifications,
    unreadCount: unreadNotifications.length,
    getUnreadPaths,
    markRead: (id: number) =>
      setUnreadNotifications((prev) => prev.filter((n) => n.notification_id !== id)),
    clearAll: () => setUnreadNotifications([]),
  }
}