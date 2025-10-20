// 文件系统访问 API 封装
// 用于管理笔记库（vault）的文件夹访问权限

const VAULT_HANDLE_KEY = 'notesapp_vault_handle';

// 扩展 Window 接口以支持 File System Access API
declare global {
  interface Window {
    showDirectoryPicker(options?: {
      mode?: 'read' | 'readwrite';
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    }): Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemHandle {
    queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  }
}

// 检查浏览器是否支持 File System Access API
export function isFileSystemSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

// 请求用户选择文件夹作为 vault
export async function requestVaultAccess(): Promise<FileSystemDirectoryHandle> {
  if (!isFileSystemSupported()) {
    throw new Error('当前浏览器不支持文件系统访问。请使用 Chrome 86+、Edge 86+ 或其他兼容浏览器。');
  }

  try {
    const dirHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });

    return dirHandle;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('用户取消了文件夹选择');
    }
    throw error;
  }
}

// 保存 vault 句柄到 IndexedDB（用于持久化）
export async function saveVaultHandle(dirHandle: FileSystemDirectoryHandle): Promise<void> {
  try {
    // 使用 IndexedDB 存储句柄
    const db = await openHandleDB();
    const tx = db.transaction('handles', 'readwrite');
    const store = tx.objectStore('handles');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        key: VAULT_HANDLE_KEY,
        handle: dirHandle,
        savedAt: Date.now(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
    });
  } catch (error) {
    console.error('保存 vault 句柄失败:', error);
    throw new Error('无法保存文件夹访问权限');
  }
}

// 获取已保存的 vault 句柄
export async function getVaultHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB();
    const tx = db.transaction('handles', 'readonly');
    const store = tx.objectStore('handles');
    
    const result: { key: string; handle: FileSystemDirectoryHandle; savedAt: number } | undefined = 
      await new Promise((resolve, reject) => {
        const request = store.get(VAULT_HANDLE_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    
    if (!result || !result.handle) {
      return null;
    }

    // 检查权限是否仍然有效
    const hasPermission = await checkPermission(result.handle);
    if (!hasPermission) {
      // 权限失效，尝试重新请求
      const permission = await result.handle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        return null;
      }
    }

    return result.handle;
  } catch (error) {
    console.error('获取 vault 句柄失败:', error);
    return null;
  }
}

// 检查文件夹权限状态
export async function checkPermission(
  dirHandle: FileSystemDirectoryHandle
): Promise<boolean> {
  try {
    const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
    return permission === 'granted';
  } catch (error) {
    console.error('检查权限失败:', error);
    return false;
  }
}

// 请求权限（如果需要）
export async function requestPermission(
  dirHandle: FileSystemDirectoryHandle
): Promise<boolean> {
  try {
    const permission = await dirHandle.requestPermission({ mode: 'readwrite' });
    return permission === 'granted';
  } catch (error) {
    console.error('请求权限失败:', error);
    return false;
  }
}

// 清除已保存的 vault 句柄
export async function clearVaultHandle(): Promise<void> {
  try {
    const db = await openHandleDB();
    const tx = db.transaction('handles', 'readwrite');
    const store = tx.objectStore('handles');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(VAULT_HANDLE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
    });
  } catch (error) {
    console.error('清除 vault 句柄失败:', error);
  }
}

// 获取 vault 名称（文件夹名）
export function getVaultName(dirHandle: FileSystemDirectoryHandle): string {
  return dirHandle.name;
}

// ==================== 内部辅助函数 ====================

// 打开用于存储句柄的 IndexedDB
function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FileSystemHandles', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles', { keyPath: 'key' });
      }
    };
  });
}


