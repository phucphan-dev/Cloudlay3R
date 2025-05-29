/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, ipcMain, Menu, shell, Tray } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import Store from 'electron-store';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import storeHandler from './handlers/store';
import registerIpcHandlers from './handlers/buckets';

const store = new Store();
class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

let tray: any = null;
if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};
const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1366,
    height: 768,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
  // Register IPC handlers

  /**
   * Add event listeners...
   */
  registerIpcHandlers(mainWindow, store);
  storeHandler(store);

  ipcMain.handle('advanced', async (event, arg) => {
    (store as any).set('advanced', JSON.stringify(arg));

    if (arg.showIcon) {
      if (!tray) {
        tray = new Tray(path.join(RESOURCES_PATH, 'icons/16x16.png'));
        tray.setContextMenu(
          Menu.buildFromTemplate([
            {
              label: 'Backup Now',
              type: 'checkbox',
              click: () => console.log('Backup Now'),
            },
          ]),
        );
      }
    } else {
      tray?.destroy();
      tray = null;
    }
    app.setLoginItemSettings({
      openAtLogin: arg.startAgent, // Chạy khi khởi động
      openAsHidden: arg.preventSleep, // Chạy ẩn
    });
  });
};

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    const settings = (store as any).get('advanced');
    if (settings) {
      const advanced = JSON.parse(settings);

      if (advanced.showIcon) {
        tray = new Tray(path.join(RESOURCES_PATH, 'icons/16x16.png'));
        tray.setContextMenu(
          Menu.buildFromTemplate([
            {
              label: 'Backup Now',
              type: 'checkbox',
              click: () => console.log('Backup Now'),
            },
          ]),
        );
      }
      app.setLoginItemSettings({
        openAtLogin: advanced.startAgent, // Chạy khi khởi động
        openAsHidden: advanced.preventSleep, // Chạy ẩn
      });
    }
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
