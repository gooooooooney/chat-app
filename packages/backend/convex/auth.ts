import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { expo } from '@better-auth/expo'
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";

const siteUrl = process.env.CONVEX_SITE_URL!;
const TRUSTED_ORIGIN_MOBILE = process.env.TRUSTED_ORIGIN_MOBILE!;

// 开发环境用于存储最新的重置token
let latestResetToken: string | null = null;

console.log("🌍 环境变量:", {
	CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
	TRUSTED_ORIGIN_MOBILE: process.env.TRUSTED_ORIGIN_MOBILE,
	CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT,
	CONVEX_URL: process.env.CONVEX_URL
});

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (
	ctx: GenericCtx<DataModel>,
	{ optionsOnly } = { optionsOnly: false },
) => {
	return betterAuth({
		logger: {
			disabled: optionsOnly,
		},
		baseURL: siteUrl,
		trustedOrigins: [siteUrl, TRUSTED_ORIGIN_MOBILE, "willchat://"],
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,

			sendResetPassword: async ({ user, url, token }, request) => {
				console.log("📧 发送密码重置邮件:");
				console.log("收件人:", user.email);
				console.log("重置链接:", url);
				console.log("重置令牌:", token);

				// 在开发环境中存储token供客户端测试使用
				latestResetToken = token;
				console.log("💾 已存储token供开发测试:", token);

				// 在开发环境中，我们可以在控制台打印重置链接
				// 这样开发者可以直接复制链接进行测试
				console.log("\n=== 🔗 密码重置深度链接 ===");
				console.log("请复制以下链接在模拟器中测试:");
				console.log(`xcrun simctl openurl booted "${url}"`);
				console.log("或在Android模拟器中使用:");
				console.log(`adb shell am start -W -a android.intent.action.VIEW -d "${url}"`);
				console.log("==========================\n");

				// TODO: 在生产环境中，这里应该调用真实的邮件发送服务
				// 例如：Resend, SendGrid, Nodemailer等
				// await sendEmail({
				//   to: user.email,
				//   subject: "重置您的密码",
				//   html: `<p>点击以下链接重置密码：</p><a href="${url}">重置密码</a>`,
				// });

				// 模拟邮件发送成功
				return Promise.resolve();
			},
			onPasswordReset: async ({ user }) => {
				// your logic here
				console.log(`Password for user ${user.email} has been reset.`);
			},
		},
		plugins: [convex(), expo()],
	});
};

export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		console.log("获取当前用户信息");
		return authComponent.getAuthUser(ctx);
	},
});

// 开发环境专用：获取最新的重置token
export const getLatestResetToken = query({
	args: {},
	handler: async (ctx) => {
		// 在开发阶段临时允许访问，后续可根据需要调整
		console.log("🔑 返回最新的重置token:", latestResetToken);
		console.log("🌍 环境信息:", {
			NODE_ENV: process.env.NODE_ENV,
			CONVEX_CLOUD_URL: process.env.CONVEX_CLOUD_URL
		});
		return { token: latestResetToken };
	},
});
