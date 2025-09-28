import React from 'react';
import { Stack } from 'expo-router';
import ChatScreen from '@/components/chat/ChatScreen';

export default function ChatPage() {
  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right',
        }} 
      />
      <ChatScreen />
    </>
  );
}