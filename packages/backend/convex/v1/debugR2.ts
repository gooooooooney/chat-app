import { action } from "../_generated/server";
import { r2, getFileUrl } from "../r2";

/**
 * 详细诊断 R2 配置问题
 */
export const diagnoseR2 = action({
  args: {},
  handler: async (ctx) => {
    console.log("🔍 开始诊断 R2 配置...");
    
    const diagnosis = {
      environment: {
        R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ? 
          `${process.env.R2_ACCESS_KEY_ID.substring(0, 4)}...${process.env.R2_ACCESS_KEY_ID.substring(-4)}` : 
          "未设置",
        R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ? 
          `${process.env.R2_SECRET_ACCESS_KEY.substring(0, 4)}...` : 
          "未设置",
        R2_TOKEN: process.env.R2_TOKEN ? 
          `${process.env.R2_TOKEN.substring(0, 4)}...` : 
          "未设置",
        R2_ENDPOINT: process.env.R2_ENDPOINT || "未设置",
        R2_BUCKET: process.env.R2_BUCKET || "未设置",
      },
      steps: []
    };

    try {
      // 步骤 1: 测试组件是否可用
      diagnosis.steps.push("✅ 步骤 1: R2 组件已加载");
      
      // 步骤 2: 尝试调用 R2 组件的基本功能
      try {
        const testResult = await r2.generateUploadUrl("simple-test.txt");
        
        diagnosis.steps.push("✅ 步骤 2: R2 组件 generateUploadUrl 调用成功");
        diagnosis.uploadUrl = testResult;
        
        // 步骤 3: 测试简单的 HTTP 请求
        const testContent = "简单测试";
        const blob = new Blob([testContent], { type: 'text/plain' });
        
        console.log("📤 尝试上传到:", testResult);
        
        const response = await fetch(testResult.url, {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': 'text/plain',
          },
        });
        
        diagnosis.uploadResponse = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        };
        
        if (response.ok) {
          diagnosis.steps.push("✅ 步骤 3: 文件上传成功");
          
          // 步骤 4: 尝试获取文件 URL
          const fileUrl = await getFileUrl("simple-test.txt");
          
          diagnosis.steps.push("✅ 步骤 4: 获取文件 URL 成功");
          diagnosis.fileUrl = fileUrl;
          
          // 步骤 5: 尝试下载文件
          const downloadResponse = await fetch(fileUrl);
          const downloadedContent = await downloadResponse.text();
          
          if (downloadedContent === testContent) {
            diagnosis.steps.push("✅ 步骤 5: 文件下载和验证成功");
            diagnosis.success = true;
          } else {
            diagnosis.steps.push("❌ 步骤 5: 文件内容验证失败");
            diagnosis.downloadedContent = downloadedContent;
            diagnosis.expectedContent = testContent;
          }
          
        } else {
          diagnosis.steps.push(`❌ 步骤 3: 文件上传失败 - ${response.status} ${response.statusText}`);
          
          // 尝试获取响应体以获得更多错误信息
          try {
            const errorBody = await response.text();
            diagnosis.errorBody = errorBody;
          } catch (e) {
            diagnosis.errorBody = "无法读取错误响应体";
          }
        }
        
      } catch (error) {
        diagnosis.steps.push(`❌ 步骤 2: R2 组件调用失败 - ${error}`);
        diagnosis.componentError = error.toString();
      }
      
    } catch (error) {
      diagnosis.steps.push(`❌ 步骤 1: R2 组件加载失败 - ${error}`);
      diagnosis.loadError = error.toString();
    }
    
    console.log("🔍 诊断完成:", diagnosis);
    return diagnosis;
  },
});

/**
 * 测试直接的 S3 兼容 API 调用
 */
export const testDirectS3Call = action({
  args: {},
  handler: async (ctx) => {
    console.log("🔍 测试直接 S3 API 调用...");
    
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const token = process.env.R2_TOKEN;
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET;
    
    if (!accessKeyId || !secretAccessKey || !token || !endpoint || !bucket) {
      return {
        success: false,
        error: "缺少必要的环境变量",
        missing: {
          accessKeyId: !accessKeyId,
          secretAccessKey: !secretAccessKey,
          token: !token,
          endpoint: !endpoint,
          bucket: !bucket,
        }
      };
    }
    
    // 测试基本的 bucket 访问
    try {
      const listUrl = `${endpoint}/${bucket}/`;
      console.log("📋 尝试列出桶内容:", listUrl);
      
      const response = await fetch(listUrl);
      
      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        canAccessBucket: response.status !== 404,
        message: response.ok ? "可以访问存储桶" : `无法访问存储桶: ${response.status} ${response.statusText}`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.toString(),
        message: "网络或配置错误"
      };
    }
  },
});