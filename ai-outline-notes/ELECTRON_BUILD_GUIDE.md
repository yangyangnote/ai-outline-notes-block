# Electron 打包完成指南

## 当前状态

✅ **已完成的配置**：
- Electron 主进程和预加载脚本
- Vite 配置支持 Electron
- electron-builder 打包配置
- package.json 脚本命令
- TypeScript 配置优化

## 磁盘空间问题

当前遇到磁盘空间不足（100% 满），无法完成 electron-builder 打包。

## 解决方案

### 方案 1：清理磁盘空间后完整打包（推荐）

1. **清理系统空间**（需要至少 5GB 可用空间）：
   ```bash
   # 清理 Homebrew 缓存
   brew cleanup

   # 清理系统缓存
   rm -rf ~/Library/Caches/*

   # 清理 npm 缓存
   npm cache clean --force

   # 清理 Docker（如果有）
   docker system prune -a
   ```

2. **重新打包**：
   ```bash
   # macOS (Apple Silicon)
   npm run electron:build:mac

   # Windows
   npm run electron:build:win

   # Linux
   npm run electron:build:linux

   # 所有平台
   npm run electron:build:all
   ```

3. **打包产物位置**：
   - `release/` 目录下会生成可分发的安装包
   - macOS: `.dmg` 和 `.zip` 文件
   - Windows: `.exe` 安装程序
   - Linux: `.AppImage` 和 `.deb` 文件

### 方案 2：简化打包（临时方案）

如果暂时无法释放磁盘空间，可以使用简化打包：

```bash
# 1. 构建 Web 应用
npm run build

# 2. 手动创建应用结构
mkdir -p app/dist app/dist-electron
cp -r dist/* app/dist/
cp -r dist-electron/* app/dist-electron/
cp package.json app/
cp electron-builder.json app/

# 3. 使用 Electron 运行
cd app
npx electron dist-electron/main.js
```

## 打包后的分发

### macOS
- **DMG 文件**：拖放式安装，用户体验最佳
- **ZIP 文件**：直接解压运行，更灵活

### Windows
- **NSIS 安装程序**：标准 Windows 安装向导
- **ZIP 文件**：便携版，无需安装

### Linux
- **AppImage**：跨发行版，无需安装
- **DEB 包**：Debian/Ubuntu 系统

## 代码签名（可选）

### macOS
需要 Apple Developer 账号：
```bash
export APPLE_ID="your@email.com"
export APPLE_ID_PASSWORD="app-specific-password"
export CSC_LINK="/path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate-password"

npm run electron:build:mac
```

### Windows
需要代码签名证书：
```bash
export WIN_CSC_LINK="/path/to/certificate.pfx"
export WIN_CSC_KEY_PASSWORD="certificate-password"

npm run electron:build:win
```

## 自动更新（可选）

可以集成 electron-updater 实现自动更新：

1. 安装依赖：
   ```bash
   npm install electron-updater
   ```

2. 配置更新服务器（GitHub Releases、S3 等）

3. 在主进程添加更新逻辑

## 发布渠道

1. **GitHub Releases**：免费托管，适合开源项目
2. **自建服务器**：完全控制
3. **Mac App Store / Microsoft Store**：官方商店（需要额外配置）

## 测试清单

- [ ] 应用能否正常启动
- [ ] 数据库（IndexedDB）能否正常工作
- [ ] 文件系统访问是否正常
- [ ] AI 功能是否正常
- [ ] 主题切换是否正常
- [ ] 多窗口管理是否正常
- [ ] 自动更新是否正常（如果配置）

## 故障排查

### 打包失败
- 检查磁盘空间
- 检查 Node.js 版本（建议 18+）
- 检查网络连接（需要下载 Electron 二进制文件）

### 应用无法启动
- 检查 electron/main.js 路径
- 检查 preload.js 配置
- 查看应用日志

### 性能问题
- 减小打包体积：配置 asarUnpack
- 优化启动速度：延迟加载重型模块

## 下一步

1. 清理磁盘空间
2. 运行 `npm run electron:build:mac`
3. 测试生成的 DMG/ZIP 文件
4. 上传到 GitHub Releases 供用户下载

---

**注意**：首次打包会下载 ~100MB 的 Electron 运行时，请确保有稳定的网络连接和足够的磁盘空间。
