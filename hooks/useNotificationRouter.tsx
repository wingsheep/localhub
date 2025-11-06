import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'

export function useNotificationRouter() {
  const router = useRouter()

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data
      if (data?.screen) router.push(`/${data.screen}` as any)
    })
    return () => sub.remove()
  }, [])
}
