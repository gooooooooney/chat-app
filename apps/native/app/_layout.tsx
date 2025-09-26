import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";
import { PortalHost } from "@rn-primitives/portal";
import {
	DarkTheme,
	DefaultTheme,
	type Theme,
	ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import { NAV_THEME } from "@/lib/theme";
import React, { useRef } from "react";
import { useColorScheme } from "@/lib/use-color-scheme";
import { Platform } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { setAndroidNavigationBar } from "@/lib/android-navigation-bar";
import { Slot } from "expo-router";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import { DeepLinkHandler } from "../components/deep-link-handler";

const LIGHT_THEME: Theme = {
	...DefaultTheme,
	colors: NAV_THEME.light.colors,
};
const DARK_THEME: Theme = {
	...DarkTheme,
	colors: NAV_THEME.dark.colors,
};

export const unstable_settings = {
	initialRouteName: "(drawer)",
};
const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
	expectAuth: false,
	unsavedChangesWarning: false,
});

export default function RootLayout() {
	const hasMounted = useRef(false);
	const { colorScheme, isDarkColorScheme } = useColorScheme();
	const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);

	useIsomorphicLayoutEffect(() => {
		if (hasMounted.current) {
			return;
		}

		if (Platform.OS === "web") {
			document.documentElement.classList.add("bg-background");
		}
		setAndroidNavigationBar(colorScheme);
		setIsColorSchemeLoaded(true);
		hasMounted.current = true;
	}, []);

	if (!isColorSchemeLoaded) {
		return null;
	}
	return (
		<ConvexBetterAuthProvider client={convex} authClient={authClient}>
			<ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
				<StatusBar style={isDarkColorScheme ? "light" : "dark"} />
				<GestureHandlerRootView style={{ flex: 1 }}>
					<KeyboardProvider>
						<DeepLinkHandler />
						{/* <Stack>
						<Stack.Screen name="(drawer)" options={{ headerShown: false }} />
						<Stack.Screen
							name="modal"
							options={{ title: "Modal", presentation: "modal" }}
						/>
					</Stack> */}

						<Slot />
						<PortalHost />
					</KeyboardProvider>
				</GestureHandlerRootView>
			</ThemeProvider>
		</ConvexBetterAuthProvider>
	);
}

const useIsomorphicLayoutEffect =
	Platform.OS === "web" && typeof window === "undefined"
		? React.useEffect
		: React.useLayoutEffect;
