// Electron preload 脚本
import { contextBridge, ipcRenderer } from 'electron';

// 向渲染进程暴露安全的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取应用版本
  getAppVersion: () => ipcRenderer.invoke('app-version'),

  // 获取应用名称
  getAppName: () => ipcRenderer.invoke('app-name'),

  // 标识运行环境
  isElectron: true,

  // 平台信息
  platform: process.platform,
});
