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
        keyof ERROR_CODES | string,
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
    },
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: {
        en: "user already registered, use another email",
        zh: "用户已存在，请使用其他邮箱",
    },
    "INVALID_EMAIL": {
        en: "invalid email",
        zh: "无效的邮箱地址",
    },
    "WEAK_PASSWORD": {
        en: "password should be at least 8 characters",
        zh: "密码至少需要8个字符",
    },
    "INVALID_PASSWORD": {
        en: "invalid password",
        zh: "无效的密码",
    },
    "INVALID_OAUTH_TOKEN": {
        en: "invalid oauth token",
        zh: "无效的第三方登录凭据",
    },
    "OAUTH_ACCOUNT_ALREADY_LINKED": {
        en: "oauth account already linked",
        zh: "第三方登录已绑定其他账户",

    }
} satisfies ErrorTypes;

export const getErrorMessage = ({ code, lang = "zh", msg }: {
    code: string,
    msg?: string
    lang?: "en" | "zh"
}) => {
    if (code in errorCodes) {
        return errorCodes[code as keyof ERROR_CODES]?.[lang] || msg;
    }
    return "";
};


