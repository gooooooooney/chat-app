import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { createAuth } from "../auth";
import { api } from "../_generated/api";
import { APIError } from "better-auth";

export const signUpWithEmail = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    rememberMe: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { email, password, name, image, rememberMe } = args;

    try {
      const result = await createAuth(ctx).api.signUpEmail({
        body: {
          email,
          password,
          name,
          image,
          rememberMe
        }
      })
      console.log('signUpWithEmail result', result);
      if (result.user === null) {
        throw new ConvexError("注册失败");
      }
      ctx.runMutation(api.v1.auth.registeredUserProfile, {
        userId: result.user.id,
        displayName: name,
        email,
        avatar: image,
      });

      return {
        data: result.user,
        error: null,
      };
    } catch (error) {
      if (error instanceof APIError) {
        return {
          data: null,
          error: {
            code: error.body?.code || '500',
            message: error.body?.message || "注册失败",
          },
        };
      }
      throw new ConvexError("注册失败");
      // return { error: { code: "internal_error", message: "注册失败" }
    }

  },
})


export const registeredUserProfile = mutation({
  args: {
    userId: v.string(),
    displayName: v.string(),
    avatar: v.optional(v.string()),
    bio: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, displayName, avatar, bio, email } = args;

    // 检查用户资料是否已存在
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existingProfile) {
      throw new ConvexError("用户资料已存在");
    }

    // 创建新的用户资料
    const newProfile = await ctx.db.insert("userProfiles", {
      userId,
      displayName,
      avatar,
      bio,
      email,
      updatedAt: Date.now(),
    });

    return newProfile;
  },
});
