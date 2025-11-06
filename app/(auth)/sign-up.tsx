import { supabase } from '@/lib/supabase'
import { zodResolver } from '@hookform/resolvers/zod'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { Alert, Button, Text, TextInput } from 'react-native'
import { z } from 'zod'

export default function SignUpScreen() {
  const SignInSchema = z.object({
    email: z.string().email('请输入合法邮箱'),
    password: z.string().min(6, '至少 6 位密码'),
    // confirmPassword: z.string().min(6, '至少 6 位密码'),
  })
  type SignUpValues = z.infer<typeof SignInSchema>
  const { control, handleSubmit, formState: { errors, isSubmitting }, setError } =
  useForm<SignUpValues>({
    resolver: zodResolver(SignInSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: SignUpValues) => {
    if (isSubmitting) return
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        // expo-router 助手：会生成 localhub://auth/callback 这样的深链
        emailRedirectTo: Linking.createURL('/auth/callback'),
      },
    })
    if (error) {
      // 把后端错误塞进表单的“根错误”
      return setError('root', { message: error.message })
    }
    Alert.alert('注册成功')
  }
  const router = useRouter()
  const toSignIn = () => {
    router.push('/(auth)/sign-in')
  }
  return (
    <>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            placeholder="邮箱"
            autoCapitalize="none"
            keyboardType="email-address"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            style={{ width:'100%', borderWidth:1, borderColor:'#ddd', padding:12, borderRadius:8, marginTop:16 }}
          />
        )}
      />
      {errors.email && <Text style={{ color:'red', marginTop:8 }}>{errors.email.message}</Text>}
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            placeholder="密码"
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            style={{ width:'100%', borderWidth:1, borderColor:'#ddd', padding:12, borderRadius:8, marginTop:12 }}
          />
        )}
      />
      {errors.password && <Text style={{ color:'red', marginTop:8 }}>{errors.password.message}</Text>}
      {errors.root && <Text style={{ color:'red', marginTop:8 }}>{errors.root.message}</Text>}

      <Button
        title={isSubmitting ? '注册中…' : '注册'}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
      />
            <Button title="去登录" onPress={toSignIn}></Button>

    </>
    
  );
}
