import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
type Product = { id: string; title: string; price: number; photos: string[]; created_at: string }

export default function HomeScreen() {
  
  
  const PAGE_SIZE = 15
  
  async function fetchProductsPage(cursor?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    let q = supabase.from('products')
      .select('id, title, price, photos, created_at', )
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
      
  
    if (cursor) q = q.lt('created_at', cursor)
  
    const { data, error } = await q
    if (error) throw error
    return data as Product[]
  }
  
  const query = useInfiniteQuery<Product[], Error, InfiniteData<Product[], string | undefined>, string[], string | undefined>({
    queryKey: ['products'],
    queryFn: ({ pageParam }) => fetchProductsPage(pageParam as string | undefined),
    getNextPageParam: (lastPage) => lastPage.length < PAGE_SIZE
      ? undefined
      : lastPage[lastPage.length - 1].created_at, // 作为下一页 cursor
    initialPageParam: undefined,
  })
  const items: Product[] = query.data?.pages.flat() ?? []
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        onEndReached={() => {
          if (query.hasNextPage) query.fetchNextPage()
        }}
        
        refreshing={query.isRefetching}
        onRefresh={() => query.refetch()}
        renderItem={({ item }) => <ProductCard item={item} />}
      />
    </SafeAreaView>
  );
}
function ProductCard({ item }: { item: Product }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}>
      <View style={{ flexDirection: 'row', padding: 8 }}>
        {item.photos?.[0] ? (
          <Image source={{ uri: item.photos[0] }} style={{ width: 80, height: 80 }} />
        ) : null}
        <ThemedText>{item.title} - ￥{item.price}</ThemedText>
      </View>
    </Pressable>
  )
}
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
