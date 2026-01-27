import { S3Client } from '@aws-sdk/client-s3';

/**
 * S3 Configuration - Singleton client for AWS S3 operations
 * Supports LocalStack for local development
 */
export class S3Config {
  private static instance: S3Client | null = null;
  private static bucketName: string | null = null;

  /**
   * Get or create S3 client instance with lazy initialization
   * Supports LocalStack for local development via AWS_ENDPOINT_URL
   */
  static getClient(): S3Client {
    if (!this.instance) {
      const region = process.env.AWS_REGION || 'us-east-1';
      const endpoint = process.env.AWS_ENDPOINT_URL; // For LocalStack

      const clientConfig: any = {
        region,
        credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
      };

      // LocalStack support for local development
      if (endpoint) {
        clientConfig.endpoint = endpoint;
        clientConfig.forcePathStyle = true; // Required for LocalStack
      }

      this.instance = new S3Client(clientConfig);

      console.log(`✅ S3 Client initialized (region: ${region}${endpoint ? ', endpoint: ' + endpoint : ''})`);
    }

    return this.instance;
  }

  /**
   * Get bucket name from environment variables
   * @throws Error if AWS_S3_BUCKET is not set
   */
  static getBucketName(): string {
    if (!this.bucketName) {
      this.bucketName = process.env.AWS_S3_BUCKET ?? null;
        
      if (!this.bucketName) {
        throw new Error('AWS_S3_BUCKET environment variable is not set');
      }

      console.log(`📦 Using S3 bucket: ${this.bucketName}`);
    }

    return this.bucketName;
  }

  /**
   * Check if S3 is enabled (all required env vars are set)
   */
  static isEnabled(): boolean {
    return !!(
      process.env.AWS_S3_BUCKET &&
      process.env.AWS_REGION &&
      (process.env.AWS_ENDPOINT_URL || // LocalStack
        (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)) // AWS
    );
  }

  /**
   * Reset singleton instance (for testing)
   */
  static reset(): void {
    this.instance = null;
    this.bucketName = null;
  }
}
