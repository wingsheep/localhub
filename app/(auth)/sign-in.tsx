import { supabase } from '@/lib/supabase'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { Button, Text, TextInput } from 'react-native'
import { z } from 'zod'
export default function SignInScreen() {
  const SignInSchema = z.object({
    email: z.string().email('请输入合法邮箱'),
    password: z.string().min(6, '至少 6 位密码'),
  })
  type SignInValues = z.infer<typeof SignInSchema>
  const { control, handleSubmit, formState: { errors, isSubmitting }, setError } =
  useForm<SignInValues>({
    resolver: zodResolver(SignInSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: SignInValues) => {
    if (isSubmitting) return
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })
    if (error) {
      // 把后端错误塞进表单的“根错误”
      setError('root', { message: error.message })
    }
  }
  const router = useRouter()
  const toSignUp = () => {
    router.push('/(auth)/sign-up')
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
        title={isSubmitting ? '登录中…' : '登录'}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
      />
      <Button title="去注册" onPress={toSignUp}></Button>
    </>
    
  );
}
