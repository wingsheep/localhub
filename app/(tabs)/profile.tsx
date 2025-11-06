import { publicUrl, supabase } from '@/lib/supabase';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, Button, Image, Keyboard, StyleSheet, Text, TextInput, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

export default function ProfileScreen() {
  const [userId, setUserId] = useState<null | undefined | string>(undefined)
  const [isUploading, setIsUploading] = useState(false)
  const ProfileSchema = z.object({
    name: z.string(),
  })
  const [image, setImage] = useState<string | null>(null);
  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
 
      // 2) 取当前用户
      if (!userId) throw new Error('Not signed in');

      // 3) 使用 FormData 上传（RN 无需 blob）
      const asset = result.assets?.[0];
      const contentType = asset?.mimeType ?? 'image/jpeg';
      const fileName = asset?.fileName ?? `${Date.now()}.jpg`;
      const filePath = `${userId}/${fileName}`; // ← 跟策略一致：uid 在第1段

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: fileName,
        type: contentType,
      } as any);
      setIsUploading(true)
      const { error: uploadError } = await supabase
        .storage
        .from('avatars')
        .upload(filePath, formData, { upsert: true });

      if (uploadError) throw uploadError;

      // 5) 保存到 profiles.avatar_url
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: filePath })
        .eq('id', userId);
      setIsUploading(false)
      if (updateError) throw updateError;
      setImage(publicUrl(filePath))
      return filePath;
    }
  };

  type ProfileValues = z.infer<typeof ProfileSchema>
  const { control, handleSubmit, setValue, formState: { errors, isSubmitting }, setError } = 
  useForm<ProfileValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: { name: '', },
  })
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUserId(user?.id ?? null);
    })();
    return () => { mounted = false; };
  }, [])

  useEffect(() => {
    if (!userId) return; // userId 还没拿到，直接跳过
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .eq('id', userId)
        .maybeSingle(); // 未命中返回 null，不抛错
  
      if (cancelled) return;
  
      if (error) {
        setError('root', { message: error.message });
        return;
      }
  
      if (!data) {
        await supabase.from('profiles').insert({ id: userId, name: '' });
      } else {
        // 可选：把已存在的名字填回表单
        setValue('name', data.name ?? '');
        setImage(data.avatar_url ?? '')
      }
    })();
  
    return () => { cancelled = true; };
  }, [userId, ])
  const onSubmit = async (values: ProfileValues) => {
    if (isSubmitting) return
    if (!userId) {
      setError('root', { message: '未获取到用户信息' });
      return;
    }
    const { error } = await supabase.from('profiles').update({ name: values.name, avatar_url: image }).eq('id', userId)
    if (error) {
      // 把后端错误塞进表单的“根错误”
      return setError('root', { message: error.message })
    }
    Alert.alert('更新成功！')
  }
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
       <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            placeholder="名称"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            style={{ width:'100%', color: '#ccc', borderWidth:1, borderColor:'#ddd', padding:12, borderRadius:8, marginTop:12 }}
          />
        )}
      />
      {errors.root && <Text style={{ color:'red', marginTop:8 }}>{errors.root.message}</Text>}

      
      <Button title="Pick an image from camera roll" disabled={isUploading} onPress={pickImage} />
      <ActivityIndicator animating={isUploading} />
      {image && <Image source={{ uri: image }} style={styles.image} />}
      <Button
        title={isSubmitting ? '修改中…' : '更新'}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
      />
    </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  image: {
    width: 200,
    height: 200,
  },
});
