import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Notification } from '../../types'

export default function NotificationBell() {
  const { user, unreadNotifications, markNotificationRead, clearAllNotifications } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // [NOTIFY] unreadCount derived from context — stays in sync with Sidebar automatically
  const unreadCount = unreadNotifications.length

  useEffect(() => {
    if (!user) return
    fetchNotifications()

    const channel = supabase
      .channel('notification-bell')
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

  // [NOTIFY] Click a notification: mark it read in DB + context, navigate to url, close dropdown
  async function handleNotificationClick(n: Notification) {
    if (!n.read) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('notification_id', n.notification_id)

      setNotifications((prev) =>
        prev.map((x) => x.notification_id === n.notification_id ? { ...x, read: true } : x)
      )
      // [NOTIFY] Update context so Sidebar dot disappears immediately
      markNotificationRead(n.notification_id)
    }

    if (n.url) {
      navigate(n.url)
      setOpen(false)
    }
  }

  // [NOTIFY] Mark all as read in DB + context
  async function handleMarkAllRead() {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user!.id)
      .eq('read', false)

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    clearAllNotifications()
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
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-[#eb2030] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-[#eb2030] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.notification_id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 transition-colors hover:bg-gray-50 ${
                    !n.read ? 'bg-red-50 hover:bg-red-100' : ''
                  } ${n.url ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 bg-[#eb2030] rounded-full mt-1.5 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

        </div>
      )}
    </div>
  )
}