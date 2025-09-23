import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { expo } from '@better-auth/expo'
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth";

const siteUrl = process.env.AUTH_SITE_URL!;
const TRUSTED_ORIGIN_MOBILE = process.env.TRUSTED_ORIGIN_MOBILE!;


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
		trustedOrigins: [siteUrl, TRUSTED_ORIGIN_MOBILE],
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			sendResetPassword: async ({ user, url, token }, request) => {
				console.log("===>",user,url, token)
				// 发送邮件给用户
				// await sendEmail({
				//   to: user.email,
				//   subject: "Reset your password",
				//   text: `Click the link to reset your password: ${url}`,
				// });
			},
			onPasswordReset: async ({ user }, request) => {
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
		return authComponent.getAuthUser(ctx);
	},
});
