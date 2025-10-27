// 文件系统 API 类型扩展
declare interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>;
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
}
