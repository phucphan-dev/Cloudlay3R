/* eslint-disable no-restricted-syntax */
import Electron, { Notification, powerMonitor } from 'electron';
import { BucketItemWithMetadata, ItemBucketMetadata } from 'minio';
import schedule from 'node-schedule';
import fs from 'fs';
import path from 'path';
import { getMinioClient } from '../client';
import { isPauseBackup } from 'utils/functions';

export const handleLogin = async (
  event: Electron.IpcMainEvent,
  arg: any,
  store: any,
) => {
  try {
    const minioClient = getMinioClient();
    const buckets = await minioClient.listBuckets();
    event.reply('login', { data: arg, buckets });
    store.set('auth', JSON.stringify(arg));
  } catch (error) {
    event.reply('login', { error });
  }
};

export const handleBackupOptions = (
  event: Electron.IpcMainEvent,
  arg: any,
  store: any,
) => {
  const { type, value } = arg;
  const backupOptionStore = store.get('backupOption');
  const advancedStore = store.get('advanced');
  const pauseIfBattery = advancedStore
    ? JSON.parse(advancedStore).pauseBackup
    : false;

  const backupData = (isPaused?: boolean) => {
    const minioClient = getMinioClient();
    const objectsListTemp: BucketItemWithMetadata[] = [];
    const bucketName = store.get('bucketName');
    const stream = minioClient.extensions.listObjectsV2WithMetadata(
      bucketName,
      '',
      true,
    );

    stream.on('data', (obj) => objectsListTemp.push(obj));
    stream.on('error', () => { });
    stream.on('end', async () => {
      const filePaths = objectsListTemp.map(
        (obj) => (obj.metadata as ItemBucketMetadata)['X-Amz-Meta-Fullpath'],
      );

      for (const filePath of filePaths) {
        try {
          fs.stat(filePath, async (err, statFile) => {
            if (err) {
              new Notification({
                title: 'Backup interval',
                body: `file ${path.basename(filePath)} not found`,
              }).show();
              return;
            }
            if (!minioClient) {
              return;
            }
            if (isPaused) {
              new Notification({
                title: 'Backup interval',
                body: `Backup is paused`,
              }).show();
              return;
            }
            const fileStream = fs.createReadStream(filePath);
            await minioClient
              .putObject(
                bucketName,
                path.basename(filePath),
                fileStream,
                statFile.size,
                {
                  fullpath: filePath,
                },
              )
              .catch(() => {
                new Notification({
                  title: 'Backup interval',
                  body: `Backup file ${path.basename(filePath)} failed`,
                }).show();
              });
          });
        } catch (error) {
          // empty
          console.log('error', error);
        }
      }
      event.reply('backup-option', { data: 'done' });
    });
  };
  Object.values(schedule.scheduledJobs).forEach((job) => {
    if (
      job.name !== 'validate' ||
      (backupOptionStore &&
        JSON.parse(backupOptionStore).value.validate !== value.validate)
    ) {
      job.cancel();
    }
  });

  const isPause =
    (value.pause && isPauseBackup(value.pause.start, value.pause.end)) ||
    (pauseIfBattery && powerMonitor.isOnBatteryPower());

  store.set('backupOption', JSON.stringify(arg));
  switch (type) {
    case 'interval':
      schedule.scheduleJob(
        'interval',
        `${!!value?.minute && value?.minute > 0 ? `*/${value?.minute}` : '*'} ${!!value?.hour && value?.hour > 0 ? `*/${value?.hour}` : '*'} * * *`,
        () => {
          if (isPause) {
            new Notification({
              title: 'Backup interval',
              body: `Backup is paused`,
            }).show();
            return;
          }
          new Notification({
            title: 'Backup interval',
            body: `Backup will be start `,
          }).show();
          backupData(isPause);
        },
      );
      break;
    case 'daily':
      schedule.scheduleJob(
        'daily',
        `${!!value?.minute && value?.minute > 0 ? value?.minute : '*'} ${!!value?.hour && value?.hour > 0 ? value?.hour : '*'} * * *`,
        () => {
          if (isPause) {
            new Notification({
              title: 'Backup interval',
              body: `Backup is paused`,
            }).show();
            return;
          }
          new Notification({
            title: 'Backup daily',
            body: `Backup will be start `,
          }).show();
          backupData(isPause);
        },
      );
      break;
    case 'manual':
      break;
    default:
      break;
  }
  if (value.validate) {
    schedule.scheduleJob('validate', `${value.validate} * *`, () => {
      if (isPause) {
        new Notification({
          title: 'Backup interval',
          body: `Backup is paused`,
        }).show();
        return;
      }
      new Notification({
        title: 'Validate backup data',
        body: `Validate will be start`,
      }).show();
      backupData(isPause);
    });
  }
};
