import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { R2, R2Callbacks } from "@convex-dev/r2";
import { DataModel } from "./_generated/dataModel";
import { authComponent } from "./auth";

const r2 = new R2(components.r2);

const callbacks: R2Callbacks = internal.r2;

export const {
  generateUploadUrl,
  syncMetadata,

  // These aren't used in the example, but can be exported this way to utilize
  // the permission check callbacks.
  getMetadata,
  listMetadata,
  deleteObject,
  onSyncMetadata,
} = r2.clientApi<DataModel>({
  // The checkUpload callback is used for both `generateUploadUrl` and
  // `syncMetadata`.
  // In any of these checks, throw an error to reject the request.
  checkUpload: async (ctx, bucket) => {
    // For testing: allow uploads without auth
    // In production, uncomment the following to require authentication
    try {
      const user = await authComponent.getAuthUser(ctx);
      console.log("checkUpload - authenticated user:", user?._id);
    } catch (error) {
      console.log("checkUpload - anonymous upload (testing mode)");
      // In production, uncomment to block anonymous uploads:
      // throw new Error("Unauthorized: Must be logged in to upload images");
    }
  },
  checkReadKey: async (ctx, bucket, key) => {
    // const user = await userFromAuth(ctx);
    // ...validate that the user can read this key
  },
  checkReadBucket: async (ctx, bucket) => {
    // const user = await userFromAuth(ctx);
    // ...validate that the user can read this bucket
  },
  checkDelete: async (ctx, bucket, key) => {
    try {
      const user = await authComponent.getAuthUser(ctx);
      if (!user) {
        throw new Error("Unauthorized: Must be logged in to delete images");
      }

      // Check if user owns this image
      const image = await ctx.db
        .query("images")
        .withIndex("bucket_key", (q) => q.eq("bucket", bucket).eq("key", key))
        .unique();

      if (image && image.uploadedBy !== user._id) {
        throw new Error("Forbidden: You can only delete your own images");
      }
    } catch (error) {
      console.log("checkDelete - error:", error);
      // In production, uncomment to block:
      // throw error;
    }
  },
  onUpload: async (ctx, bucket, key) => {
    // Store image metadata in database after successful upload
    let userId: string | undefined;

    try {
      const user = await authComponent.getAuthUser(ctx);
      userId = user?._id;
      console.log("onUpload - authenticated user:", userId);
    } catch (error) {
      console.log("onUpload - anonymous upload (testing mode)");
      // In production, you might want to throw an error here
    }

    // Get image metadata from R2
    const metadata = await r2.getMetadata(ctx, key);

    await ctx.db.insert("images", {
      bucket,
      key,
      uploadedBy: userId,
      metadata: metadata ? {
        size: metadata.size || 0,
        mimeType: metadata.contentType || "image/jpeg",
      } : undefined,
    });
  },
  onDelete: async (ctx, bucket, key) => {
    // Delete image record from database
    const image = await ctx.db
      .query("images")
      .withIndex("bucket_key", (q) => q.eq("bucket", bucket).eq("key", key))
      .unique();

    if (image) {
      await ctx.db.delete(image._id);

      // Optional: Update any messages that reference this image
      // Mark them as having a deleted/missing image
      if (image.messageId) {
        const message = await ctx.db.get(image.messageId);
        if (message) {
          await ctx.db.patch(message._id, {
            imageKey: undefined,
            imageMetadata: undefined,
            uploadStatus: "failed" as const,
          });
        }
      }
    }
  },
  onSyncMetadata: async (ctx, args) => {
    console.log("onSyncMetadata", args);
    const metadata = await r2.getMetadata(ctx, args.key);
    console.log("metadata", metadata);
  },
  callbacks,
});

export const listImages = query({
  args: {},
  handler: async (ctx) => {
    const images = await ctx.db.query("images").collect();
    return Promise.all(
      images.map(async (image) => ({
        ...image,
        url: await r2.getUrl(image.key),
      }))
    );
  },
});

export const updateImageCaption = mutation({
  args: {
    id: v.id("images"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      caption: args.caption,
    });
  },
});

export const insertImage = internalMutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("images", { key: args.key, bucket: r2.config.bucket });
  },
});

// Insert an image server side (the insertImage mutation is just an example use
// case, not required). When running the example app, you can run `npx convex run
// example:store` (or run it in the dashboard) to insert an image this way.
export const generateAndStoreRandomImage = action({
  handler: async (ctx) => {
    // Download a random image from picsum.photos
    const url = "https://picsum.photos/200/300";
    const response = await fetch(url);
    const blob = await response.blob();
    // This function call is the only required part, it uploads the blob to R2,
    // syncs the metadata, and returns the key.
    const key = await r2.store(ctx, blob);

    await ctx.runMutation(internal.r2.insertImage, { key });
  },
});