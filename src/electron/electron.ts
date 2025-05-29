import path from "path";
import { app, BrowserWindow, ipcMain, Menu, shell, Tray } from "electron";
import Store from "electron-store";
import storeHandler from "./handlers/store";
import registerIpcHandlers from "./handlers/buckets";
import MenuBuilder from "./handlers/menu";

const store = new Store();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Hàm lấy đường dẫn preload phù hợp môi trường
function getPreloadPath() {
  if (process.env.NODE_ENV === "development") {
    // Khi chạy dev, preload nằm ở src/electron/preload.js (đã build từ preload.ts)
    return path.join(__dirname, "preload.js");
  } else {
    // Khi build production, preload nằm ở cùng thư mục với main.js (dist/electron/preload.js)
    return path.join(__dirname, "preload.js");
  }
}

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    show: false,
    width: 1366,
    height: 768,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../build/index.html"));
  }

  mainWindow.on("ready-to-show", () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: "deny" };
  });

  registerIpcHandlers(mainWindow, store);
  storeHandler(store);

  ipcMain.handle("advanced", async (event, arg) => {
    (store as any).set("advanced", JSON.stringify(arg));
    if (arg.showIcon) {
      // Xử lý tray nếu cần
    } else {
      tray?.destroy();
      tray = null;
    }
    app.setLoginItemSettings({
      openAtLogin: arg.startAgent,
      openAsHidden: arg.preventSleep,
    });
  });
};

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    const settings = (store as any).get("advanced");
    if (settings) {
      const advanced = JSON.parse(settings);
      app.setLoginItemSettings({
        openAtLogin: advanced.startAgent,
        openAsHidden: advanced.preventSleep,
      });
    }
    app.on("activate", () => {
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
