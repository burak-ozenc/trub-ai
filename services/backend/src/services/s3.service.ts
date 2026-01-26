import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Config } from '../config/s3.config';
import { retryWithBackoff } from '../utils/retry';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

/**
 * S3 Service - Handle all S3 operations (upload, download, presigned URLs, delete)
 */
export class S3Service {
  private client = S3Config.getClient();
  private bucket = S3Config.getBucketName();

  /**
   * Generate a presigned URL for direct client downloads
   * @param s3Key - S3 object key
   * @param expiresIn - URL expiration time in seconds (default: 15 minutes)
   * @returns Presigned URL
   */
  async getPresignedUrl(s3Key: string, expiresIn: number = 900): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn });
    return url;
  }

  /**
   * Download S3 object to memory buffer
   * Suitable for small files (recordings, images)
   * @param s3Key - S3 object key
   * @returns Buffer containing file data
   */
  async downloadToBuffer(s3Key: string): Promise<Buffer> {
    return retryWithBackoff(async () => {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error(`Empty response body for S3 key: ${s3Key}`);
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    });
  }

  /**
   * Download S3 object to temporary file on disk
   * Suitable for large files that need to be sent to audio service
   * @param s3Key - S3 object key
   * @returns Path to temporary file
   */
  async downloadToTempFile(s3Key: string): Promise<string> {
    return retryWithBackoff(async () => {
      const buffer = await this.downloadToBuffer(s3Key);

      // Create temp file path
      const ext = path.extname(s3Key);
      const filename = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      const tempDir = path.join(process.cwd(), 'data', 'temp');

      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, filename);

      // Write buffer to file
      fs.writeFileSync(tempFilePath, buffer);

      return tempFilePath;
    });
  }

  /**
   * Upload buffer to S3
   * @param buffer - File data buffer
   * @param s3Key - S3 object key (path in bucket)
   * @param contentType - MIME type
   * @param metadata - Optional metadata
   */
  async uploadBuffer(
    buffer: Buffer,
    s3Key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    return retryWithBackoff(async () => {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
      });

      await this.client.send(command);
    });
  }

  /**
   * Upload stream to S3 using multipart upload (for large files)
   * @param stream - Readable stream
   * @param s3Key - S3 object key
   * @param contentType - MIME type
   * @param metadata - Optional metadata
   */
  async uploadStream(
    stream: Readable,
    s3Key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: s3Key,
        Body: stream,
        ContentType: contentType,
        Metadata: metadata,
      },
      queueSize: 4, // Concurrent part uploads
      partSize: 5 * 1024 * 1024, // 5MB parts
    });

    // Execute upload with retry
    await retryWithBackoff(async () => {
      await upload.done();
    });
  }

  /**
   * Delete object from S3
   * Used for cleanup of orphaned files
   * @param s3Key - S3 object key
   */
  async deleteObject(s3Key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });

      await this.client.send(command);
      console.log(`🗑️  Deleted S3 object: ${s3Key}`);
    } catch (error) {
      console.error(`❌ Failed to delete S3 object ${s3Key}:`, error);
      // Don't throw - deletion failures shouldn't break main flow
    }
  }

  /**
   * Check if an object exists in S3
   * @param s3Key - S3 object key
   * @returns true if object exists, false otherwise
   */
  async objectExists(s3Key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generate S3 key for uploaded file
   * @param prefix - Key prefix (e.g., 'recordings/practice')
   * @param userId - User ID
   * @param filename - Original filename
   * @returns S3 key
   */
  static generateKey(prefix: string, userId: number, filename: string): string {
    const timestamp = Date.now();
    const ext = path.extname(filename);
    const safeName = path.basename(filename, ext).replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    return `${prefix}/user-${userId}/${safeName}-${timestamp}${ext}`;
  }

  /**
   * Get S3 URL for a key (s3://bucket/key format)
   * @param s3Key - S3 object key
   * @returns S3 URL
   */
  getS3Url(s3Key: string): string {
    return `s3://${this.bucket}/${s3Key}`;
  }
}
