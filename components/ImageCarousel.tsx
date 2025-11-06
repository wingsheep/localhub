import { Image } from 'expo-image'
import { useState } from 'react'
import { View } from 'react-native'
import PagerView from 'react-native-pager-view'

export function ImageCarousel({ uris }: { uris: string[] }) {
  const [page, setPage] = useState(0)
  const height = Math.min(420, /* 也可用屏宽计算比例 */ 300)
  return (
    <View style={{width: '100%', height, backgroundColor:'#000' }}>
      <PagerView style={{ flex:1 }} initialPage={0} onPageSelected={e => setPage(e.nativeEvent.position)}>
        {uris?.map((u, idx) => (
          <View key={u || idx} style={{ flex:1 }}>
            <Image
              source={{ uri: u }}
              style={{ width:'100%', height:'100%' }}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          </View>
        ))}
      </PagerView>

      {/* 简易指示器 */}
      <View style={{ position:'absolute', bottom:10, left:0, right:0, flexDirection:'row', justifyContent:'center', gap:6 }}>
        {uris?.map((_, i) => (
          <View key={i} style={{
            width: i===page ? 10 : 6, height: 6, borderRadius:3,
            backgroundColor: i===page ? '#fff' : 'rgba(255,255,255,0.5)'
          }}/>
        ))}
      </View>
    </View>
  )
}
