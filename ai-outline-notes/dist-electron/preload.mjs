"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // 获取应用版本
  getAppVersion: () => electron.ipcRenderer.invoke("app-version"),
  // 获取应用名称
  getAppName: () => electron.ipcRenderer.invoke("app-name"),
  // 标识运行环境
  isElectron: true,
  // 平台信息
  platform: process.platform
});
