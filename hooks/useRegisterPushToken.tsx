import { supabase } from '@/lib/supabase'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { useEffect } from 'react'
import { Platform } from 'react-native'
 
// 通知样式设置
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
})

export function useRegisterPushToken() {
  useEffect(() => {
    registerForPushNotificationsAsync()
  }, [])
}

async function registerForPushNotificationsAsync() {
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') {
      alert('未授予推送权限')
      return
    }

    // SDK 49+ 在裸项目/Dev Client 需要手动传 projectId
    const projectId =
      // EAS Build 运行时
      (Constants as any).easConfig?.projectId ??
      // Expo Go/Dev Client 从 app.json 读取
      (Constants.expoConfig as any)?.extra?.eas?.projectId

    if (!projectId) {
      console.warn('未找到 Expo projectId，跳过获取 Expo Push Token。请在 app.json 配置 expo.extra.eas.projectId')
    } else {
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
      console.log('Expo Push Token:', token)
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      // 👇 建议上传到 Supabase profiles 表
      userId && await supabase.from('profiles').update({ expo_push_token: token }).eq('id', userId)
    }
  } else {
    console.warn('需真机测试推送')
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    })
  }
}
