import { useRouter } from 'expo-router'
import { Button, Text } from 'react-native'

export default function CallBackScreen() {
  const router = useRouter()
  const onBackHome = () => {
    router.push('/(tabs)')
  }
  return (
    <>
      <Text>注册成功！</Text>
      <Button title="返回首页" onPress={onBackHome}></Button>
    </>
  )
}
