import { View, Text } from "react-native";
import React from "react";
import { Stack } from "expo-router";
import { NotificationProvider } from "@/contexts/NotificationContext";

const Layout = () => {
  return (
    <NotificationProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(pages)/add-friend" options={{ headerShown: false }} />
        <Stack.Screen name="(pages)/friend-detail" options={{ headerShown: false }} />
      </Stack>
    </NotificationProvider>
  );
};

export default Layout;
