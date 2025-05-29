import { BrowserWindow, dialog } from 'electron';
import { BucketItemStat } from 'minio';
import fs from 'fs';
import { Throttle } from 'stream-throttle';
import path from 'path';
import { getMinioClient } from '../client';

export const handleGetBucketData = async (
  bucket: string,
): Promise<BucketItemStat[]> => {
  return new Promise<BucketItemStat[]>((resolve, reject) => {
    const minioClient = getMinioClient();
    const objectsListTemp: BucketItemStat[] = [];
    const stream = minioClient.listObjects(bucket, '', true, {
      IncludeVersion: true,
    });

    stream.on('data', (obj) => {
      objectsListTemp.push(obj as BucketItemStat);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(objectsListTemp));
  });
};

export const handleSelectFile = async (
  mainWindow: BrowserWindow,
  store: any,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (mainWindow === null) {
      reject(new Error('Main window not initialized'));
      return;
    }
    const settings = store.get('advanced');
    const networkSettings = store.get('network');
    const bucket = store.get('bucketName');
    const speed: number | undefined =
      networkSettings && JSON.parse(networkSettings).fixed
        ? JSON.parse(networkSettings).fixed
        : undefined;
    const cpu: number | undefined =
      networkSettings && JSON.parse(networkSettings).cpu
        ? JSON.parse(networkSettings).cpu
        : undefined;

    dialog
      .showOpenDialog(mainWindow, {
        properties:
          settings && JSON.parse(settings).showHiddenFiles
            ? ['openDirectory', 'multiSelections', 'showHiddenFiles']
            : ['openDirectory', 'multiSelections'],
      })
      .then(async (result) => {
        // no result
        if (result.canceled || result.filePaths.length === 0) {
          reject(new Error('No file selected'));
          return;
        }
        const minioClient = getMinioClient();
        const selectedFolder = result.filePaths[0];
        const folderName = path.basename(selectedFolder);
        console.log({ folderName });

        const uploadFilesRecursively = async (folderPath: string) => {
          const files = fs.readdirSync(folderPath);

          // eslint-disable-next-line no-restricted-syntax
          for (const file of files) {
            const filePath = path.join(folderPath, file);
            const fileStat = fs.statSync(filePath);

            if (fileStat.isDirectory()) {
              // Nếu là thư mục, gọi đệ quy để xử lý thư mục con
              // eslint-disable-next-line no-await-in-loop
              await uploadFilesRecursively(filePath);
            } else if (fileStat.isFile()) {
              let fileStream: any;
              if (speed) {
                const throttle = new Throttle({ rate: speed * 1024 }); // 100kb/s
                fileStream = fs.createReadStream(filePath).pipe(throttle);
              } else {
                fileStream = fs.createReadStream(filePath);
              }
              fs.stat(filePath, async (err, statFile) => {
                if (err) {
                  return;
                }
                const index = filePath.indexOf(folderName);
                const pathFromFolderName = filePath.substring(index);
                await minioClient.putObject(
                  bucket,
                  pathFromFolderName,
                  fileStream,
                  statFile.size,
                  {
                    fullpath: filePath,
                  },
                );
              });
            }
            if (cpu) {
              const delayWithCpu = (10 - cpu / 10) * 1000;
              await new Promise((res) => setTimeout(res, delayWithCpu));
            }
          }
        };

        try {
          await uploadFilesRecursively(selectedFolder);
          await handleGetBucketData(bucket);
          resolve();
        } catch (uploadError) {
          reject(
            new Error(
              `Failed to upload files: ${(uploadError as any).message}`,
            ),
          );
        }
      })
      .catch((error) => reject(error));
  });
};

export const handleStatObject = async (
  fileName: string,
  versionId: string,
  bucket: string,
): Promise<BucketItemStat> => {
  return new Promise((resolve, reject) => {
    const minioClient = getMinioClient();
    minioClient
      .statObject(bucket, fileName, { versionId })
      .then((stat) => {
        return resolve(stat);
      })
      .catch(reject);
  });
};

export const handleDownloadFile = async (
  mainWindow: BrowserWindow,
  downloadParams: any,
  bucket: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (mainWindow === null) {
      reject(new Error('Main window not initialized'));
    }
    dialog
      .showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
      })
      .then(async (result) => {
        const minioClient = getMinioClient();
        const dataStream2 = await minioClient.getObject(
          bucket,
          downloadParams.fileName,
          {
            versionId: downloadParams.versionId,
          },
        );

        const filePath = path.join(
          result.filePaths[0],
          downloadParams.fileName,
        );
        const fileStream = fs.createWriteStream(filePath);

        dataStream2.on('data', (chunk) => {
          fileStream.write(chunk);
        });

        dataStream2.on('end', () => {
          fileStream.end();
          resolve();
        });

        dataStream2.on('error', (err) => {
          fileStream.end();
          reject(err);
        });
      });
  });
};
