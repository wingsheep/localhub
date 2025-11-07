import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNotificationRouter } from '@/hooks/useNotificationRouter';
import { useRegisterPushToken } from '@/hooks/useRegisterPushToken';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://ed3972ba149f03ed2f81b03819a122b1@o4510321395564544.ingest.us.sentry.io/4510321396809728',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export const unstable_settings = {
  anchor: '(tabs)',
};
export default Sentry.wrap(function RootLayout() {
  useRegisterPushToken()
  useNotificationRouter()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const router = useRouter();
  const segments = useSegments();
  const rootNavState = useRootNavigationState()

  const colorScheme = useColorScheme();
  useEffect(() => {
    const checkConnection = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      setSession(session);
      console.log('Supabase session check:', session, error)
      if (error) {
        console.error('Error checking session:', error);
      }
    }
    const {data: { subscription }} = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event)
      setSession(session);
    })
    checkConnection()
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!rootNavState?.key) return            // 🚫 导航还没就绪
    // 等待 session 检查完后再判断
    if (session === undefined) return     // 会话未判定

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      // 未登录却在非登录页 -> 去登录页
      router.replace('/(auth)/sign-in')
    } else if (session && inAuthGroup) {
      // 已登录却还在登录页 -> 去主页
      router.replace('/(tabs)')
    }
  }, [session, segments])
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryClientProvider>
  );
});