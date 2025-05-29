import { ipcMain } from 'electron';

const storeHandler = (store: any) => {
  ipcMain.on('cloudlay3r-store-get', async (event, val) => {
    event.returnValue = store.get(val);
  });
  ipcMain.on('cloudlay3r-store-set', async (event, key, val) => {
    store.set(key, val);
  });
  ipcMain.on('cloudlay3r-store-clear', async () => {
    store.clear();
  });
  ipcMain.on('cloudlay3r-store-delete', async (event, key) => {
    store.delete(key);
  });
};

export default storeHandler;
