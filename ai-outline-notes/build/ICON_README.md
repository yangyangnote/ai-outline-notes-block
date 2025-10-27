# 应用图标说明

需要准备以下图标文件：

## macOS
- `build/icon.icns` - macOS 应用图标（.icns 格式）
  - 推荐尺寸：1024x1024
  - 可以使用在线工具将 PNG 转换为 ICNS：https://cloudconvert.com/png-to-icns

## Windows
- `build/icon.ico` - Windows 应用图标（.ico 格式）
  - 推荐尺寸：256x256
  - 可以使用在线工具将 PNG 转换为 ICO：https://cloudconvert.com/png-to-ico

## Linux
- `build/icon.png` - Linux 应用图标（PNG 格式）
  - 推荐尺寸：512x512 或 1024x1024

## 临时方案

如果暂时没有图标，可以：
1. 使用 Figma/Sketch 设计一个简单的图标
2. 使用 AI 工具生成图标（如 DALL-E、Midjourney）
3. 使用开源图标库（如 Heroicons、Lucide）
4. 跳过图标，先完成打包测试（会使用默认 Electron 图标）

## 快速生成图标

可以使用 `electron-icon-builder` 工具：

```bash
npm install -g electron-icon-builder
electron-icon-builder --input=./icon.png --output=./build --flatten
```

这会从一个 PNG 文件生成所有平台的图标。
