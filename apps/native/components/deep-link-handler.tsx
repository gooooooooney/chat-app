import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

export function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    // 处理应用启动时的深度链接
    const getInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleDeepLink(initialUrl);
      }
    };

    // 处理应用运行时的深度链接
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    getInitialURL();

    return () => subscription?.remove();
  }, []);

  const handleDeepLink = (url: string) => {
    console.log('Deep link received:', url);
    
    try {
      const parsedUrl = Linking.parse(url);
      console.log('Parsed deep link:', parsedUrl);

      // 处理密码重置链接
      if (parsedUrl.path === '(auth)/set-password' || parsedUrl.path === 'set-password') {
        const token = parsedUrl.queryParams?.token as string;
        if (token) {
          // 导航到设置密码页面并传递token
          router.push(`/set-password?token=${encodeURIComponent(token)}`);
        } else {
          console.warn('No token found in deep link');
        }
      }
    } catch (error) {
      console.error('Error parsing deep link:', error);
    }
  };

  return null; // 这是一个逻辑组件，不渲染任何UI
}