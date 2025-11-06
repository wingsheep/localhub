import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
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
}
