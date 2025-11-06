import { ImageCarousel } from '@/components/ImageCarousel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, FlatList, Keyboard, StyleSheet, TextInput, TouchableWithoutFeedback, View } from 'react-native';
type Product = { id: string; title: string; price: number; photos: string[]; created_at: string };
type Message = { id: string; room: string; sender: string; type: string; content: string; created_at: string }
export default function ProductDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [userId, setUserId] = useState<null | undefined | string>(undefined)
  const [viewers, setViewers] = useState(0)
  const [value, setValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [channelReady, setChannelReady] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastTypingEmitRef = useRef(0)
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const THROTTLE_MS = 500
  const IDLE_MS = 2000
  const room = useMemo(() => (typeof id === 'string' && id ? `product:${id}` : ''), [id])
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!room) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUserId(user?.id ?? null);
      const channel = supabase.channel(room, {
        config: {
          presence: { key: user?.id }, // 每个用户唯一 key
          broadcast: { self: false },  // 允许广播（不接收自身）
        },
      });
      channelRef.current = channel
      channel.on('presence', { event: 'sync' }, () => {
        if (!channelRef.current) return;
        const state = channelRef.current.presenceState(); // { userId: [{...metadata}] }
        const viewers = Object.keys(state).length;
        setViewers(viewers);
      });
      channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
        console.log('broadcast', payload.isTyping)
        setSomeoneTyping(payload.isTyping)  // 简单做个 2s 超时清理
      })
      // 断网重连提示
      channel.on('system', { event: 'reconnecting' }, () => {
        console.log('reconnecting')
        setIsConnecting(true)
      })
      channel.on('system', { event: 'reconnected' }, () => {
        console.log('reconnected')
        setIsConnecting(false)
        // 保险起见，重发一次 presence
        channelRef.current?.track({ at: Date.now() })
      })
      channel.on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room=eq.${room}` },
        (payload) => {
          const newMsg = payload.new as Message
          console.log(newMsg, 'postgres_changes')
          // 去重：优先用服务端消息替换本地乐观消息；若已存在同 id，则忽略
          qc.setQueryData(['messages', room], (old: Message[] = []) => {
            if (!newMsg) return old
            // 已有相同 id -> 忽略
            if (old.some((m) => m.id === newMsg.id)) return old
            // 找到可能的乐观项 -> 用真实消息替换
            const idx = old.findIndex(
              (m) => m.id.startsWith('optimistic-') && m.sender === newMsg.sender && m.content === newMsg.content
            )
            if (idx !== -1) {
              const next = old.slice()
              next[idx] = newMsg
              return next
            }
            // 默认追加
            return [...old, newMsg]
          })
        }
      )
      channel.subscribe(async (status) => {
        console.log('subscribe', status);
        if (status === 'SUBSCRIBED') {
          setChannelReady(true)
          setIsConnecting(false)
          channelRef.current?.track({ at: Date.now() }); // 上报一些元信息
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          setIsConnecting(true)
        }
      });
    })();
    return () => {
      mounted = false;
      setChannelReady(false)
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current)
        typingStopTimerRef.current = null
      }
      if (channelRef.current) {
        try { channelRef.current.untrack(); } catch {}
        try { supabase.removeChannel(channelRef.current); } catch {}
        channelRef.current = null
      }
    };
  }, [room])
  async function fetchProduct(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('id, title, price, photos, created_at')
      .eq('id', id);
    if (error) throw error;
    return (data ?? []) as Product[];
  }

  async function fetchMessages(): Promise<Message[]> {
    if (!room) return []
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room', room)
      .order('created_at', { ascending: true })
      .limit(50)
    if (error) throw error
    return (data ?? []) as Message[]
  }

  const query = useQuery<Product[]>({
    queryKey: ['product', id],
    queryFn: fetchProduct,
    enabled: !!id,
  });

  const item = query.data?.[0] ?? null;
  const qc = useQueryClient()
  const uid = userId

  const favKey = ['fav', id, uid]

  const addFav = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('product_favorites').insert({ user_id: uid, product_id: id })
      if (error) throw error
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: favKey })
      const prev = qc.getQueryData<boolean>(favKey)
      qc.setQueryData(favKey, true) // 乐观：先置 true
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(favKey, ctx.prev) // 回滚
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: favKey })
      qc.invalidateQueries({ queryKey: ['products'] }) // 让列表同步（若列表展示收藏态）
    },
  })

  const removeFav = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('product_favorites')
        .delete()
        .eq('user_id', uid)
        .eq('product_id', id)
      if (error) throw error
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: favKey })
      const prev = qc.getQueryData<boolean>(favKey)
      qc.setQueryData(favKey, false)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(favKey, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: favKey })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const checkFav = async() => {
    const { data, error } = await supabase
    .from('product_favorites')
    .select('product_id')
    .eq('user_id', uid)
    .eq('product_id', id)
    .maybeSingle()
    if (error) throw error
    console.log(data, 'checkFav')
    return !!data 
  }

  const { data: isFav } = useQuery({ queryKey: favKey, queryFn: checkFav })
  const messagesQuery = useQuery<Message[]>({
    queryKey: ['messages', room],
    queryFn: fetchMessages,
    enabled: !!room && channelReady,
    initialData: () => (qc.getQueryData(['messages', room]) as Message[] | undefined) ?? [],
  })
  const onChange = (val: string) => {
    setValue(val)
    if (channelReady) {
      const now = Date.now()
      if (now - lastTypingEmitRef.current >= THROTTLE_MS) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: userId, isTyping: true }
        })
        lastTypingEmitRef.current = now
      }
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current)
      typingStopTimerRef.current = setTimeout(() => {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: userId, isTyping: false }
        })
      }, IDLE_MS)
    }
  }
  const onBlur = () => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current)
      typingStopTimerRef.current = null
    }
    if (channelReady) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: userId, isTyping: false }
      })
    }
  }
  function setSomeoneTyping(isTyping: boolean) {
    console.log('setSomeoneTyping')
    setIsTyping(isTyping)
  }

  const send = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase
        .from('messages')
        .insert({ room, sender: userId, type: 'text', content: text })
      if (error) throw error
    },
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey: ['messages', room] })
      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
        room,
        sender: userId!,
        type: 'text',
        content: text,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData(['messages', room], (old: Message[] = []) => [...old, optimistic])
      setValue('')
      return { optimisticId: optimistic.id }
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(['messages', room], (old: Message[] = []) => old.filter(m => m.id !== ctx?.optimisticId))
    },
    // onSettled 不必强制刷新：Realtime INSERT 会把真消息推过来，自动替换
  })
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View>
          {item?.photos && <ImageCarousel uris={item.photos as string[]} />}
          <Button
            title={isFav ? '已收藏' : '收藏'}
            onPress={() => (isFav ? removeFav.mutate() : addFav.mutate())}
            disabled={addFav.isPending || removeFav.isPending}
          />
          <ThemedText>在线人数：{viewers}</ThemedText>
          {isConnecting && <ThemedText>连接中…</ThemedText>}
          <FlatList
            data={messagesQuery.data}
            keyExtractor={(m) => m.id}
            renderItem={({ item: m }) => (
              <ThemedView style={styles.page}>
                <ThemedText>{m.sender.slice(0, 4)}：</ThemedText>
                <ThemedText>{m.content}</ThemedText>
              </ThemedView>
            )}
            style={{ maxHeight: 240, marginTop: 12 }}
            ListEmptyComponent={<ThemedText>暂无消息</ThemedText>}
          />
          {isTyping && <ThemedText>Ta 正在输入…</ThemedText>}
          <TextInput
              placeholder="发消息"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              style={{ width:'100%', color: '#ccc', borderWidth:1, borderColor:'#ddd', padding:12, borderRadius:8, marginTop:12 }}
            />
            <Button
              title="发送"
              onPress={() => send.mutate(value)}
            />
            <ThemedText>{JSON.stringify(send.data)}</ThemedText>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row'
  },
});
