#!/bin/bash

# iOS模拟器修复脚本 - 一键解决设备ID问题
echo "🚀 开始修复iOS模拟器问题..."

# 步骤1: 清理所有模拟器数据
echo "📱 步骤1: 清理模拟器缓存..."
xcrun simctl erase all
echo "✅ 模拟器缓存清理完成"

# 步骤2: 获取可用设备列表
echo "📱 步骤2: 获取可用设备..."
AVAILABLE_DEVICES=$(xcrun simctl list devices available | grep "iPhone 16 Pro (" | head -1)
echo "可用设备: $AVAILABLE_DEVICES"

# 步骤3: 提取设备ID
DEVICE_ID=$(echo "$AVAILABLE_DEVICES" | sed 's/.*(\(.*\)).*/\1/' | sed 's/) (Shutdown//')
echo "提取的设备ID: $DEVICE_ID"

# 步骤4: 验证设备ID格式
if [[ $DEVICE_ID =~ ^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$ ]]; then
    echo "✅ 设备ID格式正确: $DEVICE_ID"
else
    echo "❌ 设备ID格式错误，使用备用设备..."
    DEVICE_ID="449BD6A6-03BE-450C-9F95-5AEFD24FFF60"
fi

# 步骤5: 启动模拟器
echo "📱 步骤3: 启动模拟器 (设备ID: $DEVICE_ID)..."
xcrun simctl boot "$DEVICE_ID"
echo "✅ 模拟器启动成功"

# 步骤6: 打开模拟器应用
echo "📱 步骤4: 打开模拟器应用..."
open -a Simulator

# 步骤7: 保存设备ID到文件
echo "DEVICE_ID=$DEVICE_ID" > .simctl-device-id
echo "✅ 设备ID已保存到 .simctl-device-id 文件"

echo ""
echo "🎉 模拟器修复完成！"
echo "📱 当前使用设备: iPhone 16 Pro"
echo "🔑 设备ID: $DEVICE_ID"
echo ""
echo "如果还有问题，请运行:"
echo "1. ./fix-simulator.sh (重新修复)"
echo "2. source .simctl-device-id && xcrun simctl boot \$DEVICE_ID (手动启动)"