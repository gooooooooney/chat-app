import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { expoClient } from '@better-auth/expo/client'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'

export const authClient = createAuthClient({
    baseURL: process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
    plugins: [
        expoClient({
            scheme: Constants.expoConfig?.scheme as string,
            storagePrefix: Constants.expoConfig?.scheme as string,
            storage: SecureStore,
        }),
        convexClient(),
    ],
});

type ERROR_CODES = typeof ERROR_CODES

type ErrorTypes = Partial<
    Record<
        keyof ERROR_CODES,
        {
            en: string;
            zh: string;
        }
    >
>;

export const ERROR_CODES = authClient.$ERROR_CODES

const errorCodes: ErrorTypes = {
    ['USER_ALREADY_EXISTS']: {
        en: "user already registered",
        zh: "用户已存在",
    },
    INVALID_EMAIL_OR_PASSWORD: {
        en: "",
        zh: "无效的用户名或密码"
    }
} satisfies ErrorTypes;

export const getErrorMessage = ({ code, lang = "zh", msg }: {
    code: string,
    msg?: string
    lang?: "en" | "zh"
}) => {
    if (code in errorCodes) {
        return msg || errorCodes[code as keyof ERROR_CODES]?.[lang];
    }
    return "";
};


