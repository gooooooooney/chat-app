import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";

export const r2 = new R2(components.r2);

// 客户端 API 配置，用于前端直接上传
export const { generateUploadUrl, syncMetadata } = r2.clientApi({
  checkUpload: async (_ctx, _bucket) => {
    // 这里可以添加用户权限验证
    // 现在先允许所有上传
  },
  onUpload: async (_ctx, _bucket, key) => {
    // 上传完成后的回调
    console.log(`文件上传完成: ${key}`);
  },
});

// 获取文件 URL（使用 R2 组件的 getUrl 方法）
export async function getFileUrl(key: string, options?: { expiresIn?: number }) {
  return await r2.getUrl(key, options);
}