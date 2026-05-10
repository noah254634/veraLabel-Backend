import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../config/r2Upload.js';
import logger from '../config/logger.js';

/**
 * Verify that a file exists in R2 bucket
 * @param {string} key - The R2 object key (path)
 * @returns {Promise<Object>} Object metadata if exists
 * @throws {Error} If file doesn't exist or check fails
 */
export async function verifyFileInR2(key) {
  if (!key) {
    throw new Error('R2 key is required');
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    const response = await r2.send(command);

    logger.info('R2 file verified', {
      key,
      size: response.ContentLength,
      lastModified: response.LastModified,
    });

    return {
      exists: true,
      size: response.ContentLength,
      lastModified: response.LastModified,
      contentType: response.ContentType,
    };
  } catch (error) {
    if (error.name === 'NotFound') {
      const msg = `File not found in R2: ${key}`;
      logger.warn(msg);
      throw new Error(msg);
    }

    logger.error('R2 file verification failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to verify file in R2: ${error.message}`);
  }
}
