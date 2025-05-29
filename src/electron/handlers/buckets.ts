import { ipcMain, BrowserWindow } from 'electron';
import { handleBackupOptions, handleLogin } from './functions/icpListenerFns';
import {
  handleDownloadFile,
  handleGetBucketData,
  handleSelectFile,
  handleStatObject,
} from './functions/icpHandleFns';
import { initMinioClient } from './client';

const registerIpcHandlers = (mainWindow: BrowserWindow, store: any) => {
  ipcMain.on('login', async (event, arg) => {
    initMinioClient(arg);
    await handleLogin(event, arg, store);
  });

  ipcMain.handle('get-bucket-data', async () => {
    const bucketName = store.get('bucketName');
    const data = await handleGetBucketData(bucketName);
    return data;
  });

  ipcMain.handle('select-file', async () => {
    await handleSelectFile(mainWindow, store);
  });

  ipcMain.handle('stat-object', async (event, fileName, versionId) => {
    const bucketName = store.get('bucketName');
    const result = await handleStatObject(fileName, versionId, bucketName);
    return result;
  });

  ipcMain.handle('download-file', async (event, downloadParams) => {
    const bucketName = store.get('bucketName');
    await handleDownloadFile(mainWindow, downloadParams, bucketName);
  });
  ipcMain.on('backup-option', async (event, arg) =>
    handleBackupOptions(event, arg, store),
  );
};

export default registerIpcHandlers;
