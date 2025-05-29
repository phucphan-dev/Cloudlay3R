import { Client } from 'minio';

// Define the configuration type
interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  region: string;
}
let minioClient: Client | null = null;

export function initMinioClient(config: MinioConfig) {
  minioClient = new Client({
    ...config,
    region: 'us-east-1',
  });
}

export function getMinioClient(): Client {
  if (!minioClient) {
    throw new Error('Minio client has not been initialized yet.');
  }
  return minioClient;
}
