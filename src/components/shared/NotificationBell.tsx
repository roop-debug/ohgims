import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Notification } from '../../types'

export default function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // Fetch notifications on mount
  useEffect(() => {
    if (!user) return
    fetchNotifications()

    // Realtime subscription — new notifications appear instantly
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) setNotifications(data)
  }

  async function handleOpen() {
    setOpen((v) => !v)

    // Mark all as read when opening
    if (!open && unreadCount > 0) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user!.id)
        .eq('is_read', false)

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      )
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="relative" ref={dropdownRef}>

      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-[#E8400C] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">Notifications</p>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 flex gap-3 ${!n.is_read ? 'bg-orange-50' : ''}`}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 bg-[#E8400C] rounded-full mt-1.5 flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>

        </div>
      )}
    </div>
  )
}