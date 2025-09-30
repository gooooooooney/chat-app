import { action } from "../_generated/server";
import { v } from "convex/values";
import { r2, getFileUrl } from "../r2";

/**
 * 测试 R2 连接和上传功能
 */
export const testR2Connection = action({
  args: {},
  handler: async (ctx) => {
    try {
      console.log("🔍 开始测试 R2 连接...");
      
      // 1. 测试生成上传 URL
      const testKey = `test/connection-test-${Date.now()}.txt`;
      console.log(`📝 生成测试文件键: ${testKey}`);
      
      const uploadResult = await r2.generateUploadUrl(testKey);
      console.log("✅ 成功生成上传 URL");
      console.log("Upload Result:", uploadResult);
      
      // 2. 创建测试文件内容
      const testContent = `R2 连接测试 - ${new Date().toISOString()}`;
      const blob = new Blob([testContent], { type: 'text/plain' });
      
      // 3. 上传测试文件
      console.log("📤 开始上传测试文件...");
      const uploadResponse = await fetch(uploadResult.url, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`上传失败: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }
      
      console.log("✅ 文件上传成功");
      
      // 4. 测试获取文件 URL
      console.log("🔗 生成文件访问 URL...");
      const fileUrl = await getFileUrl(testKey);
      console.log("✅ 成功生成文件访问 URL");
      console.log("File URL:", fileUrl);
      
      // 5. 测试下载文件
      console.log("📥 测试文件下载...");
      const downloadResponse = await fetch(fileUrl);
      if (!downloadResponse.ok) {
        throw new Error(`下载失败: ${downloadResponse.status} ${downloadResponse.statusText}`);
      }
      
      const downloadedContent = await downloadResponse.text();
      console.log("✅ 文件下载成功");
      console.log("Downloaded content:", downloadedContent);
      
      // 6. 验证内容是否匹配
      if (downloadedContent.trim() === testContent.trim()) {
        console.log("✅ 内容验证成功");
      } else {
        throw new Error("内容验证失败");
      }
      
      return {
        success: true,
        message: "R2 连接测试完全成功！",
        details: {
          testKey,
          uploadUrl: uploadResult.url,
          fileUrl,
          uploadedContent: testContent,
          downloadedContent,
        }
      };
      
    } catch (error) {
      console.error("❌ R2 连接测试失败:", error);
      return {
        success: false,
        message: `R2 连接测试失败: ${error.message}`,
        error: error.toString(),
      };
    }
  },
});

/**
 * 测试环境变量配置
 */
export const testR2Config = action({
  args: {},
  handler: async (ctx) => {
    const config = {
      hasAccessKeyId: !!process.env.R2_ACCESS_KEY_ID,
      hasSecretAccessKey: !!process.env.R2_SECRET_ACCESS_KEY,
      hasEndpoint: !!process.env.R2_ENDPOINT,
      hasBucket: !!process.env.R2_BUCKET,
      hasToken: !!process.env.R2_TOKEN,
      accessKeyIdLength: process.env.R2_ACCESS_KEY_ID?.length || 0,
      secretKeyLength: process.env.R2_SECRET_ACCESS_KEY?.length || 0,
      tokenLength: process.env.R2_TOKEN?.length || 0,
      endpoint: process.env.R2_ENDPOINT,
      bucket: process.env.R2_BUCKET,
    };
    
    const allConfigured = config.hasAccessKeyId && 
                         config.hasSecretAccessKey && 
                         config.hasEndpoint && 
                         config.hasBucket &&
                         config.hasToken;
    
    return {
      success: allConfigured,
      message: allConfigured ? "所有 R2 环境变量已正确配置" : "缺少必要的 R2 环境变量",
      config,
    };
  },
});

/**
 * 简单的测试清理功能 (注意：R2 组件删除功能需要通过其他方式实现)
 */
export const cleanupTestFiles = action({
  args: {
    testKey: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    // R2 组件的删除功能需要使用组件内部方法
    // 这里返回指导信息
    return {
      success: false,
      message: "清理功能需要使用 R2 控制台或其他工具手动删除测试文件",
      info: args.testKey ? `需要删除的文件: ${args.testKey}` : "需要删除所有 test/ 前缀文件"
    };
  },
});