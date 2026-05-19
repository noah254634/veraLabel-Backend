import { r2 } from "../../config/r2Upload.js";
import logger from "../../config/logger.js";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const r2ContentFetcher = {
  fetchTaskContent: async (r2Ref, options = {}) => {
    try {
      if (!r2Ref || typeof r2Ref !== 'string') {
        throw new Error('r2Ref is required and must be a string');
      }

      logger.info('Fetching task content from R2', { r2Ref });

      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2Ref
      });

      const object = await r2.send(command);
      if (!object) {
        throw new Error(`Content not found in R2: ${r2Ref}`);
      }

      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of object.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      logger.debug('Task content fetched from R2', {
        r2Ref,
        size: object.ContentLength,
        etag: object.ETag
      });

      return buffer;
    } catch (error) {
      logger.error('Error fetching content from R2', {
        r2Ref,
        error: error.message
      });
      throw error;
    }
  },

  getPresignedUrl: async (r2Ref, expiresIn = 1440) => {
    try {
      if (!r2Ref || typeof r2Ref !== 'string') {
        throw new Error('r2Ref is required and must be a string');
      }

      logger.debug('Generating presigned URL for R2 content', { r2Ref, expiresIn });

      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2Ref
      });

      const url = await getSignedUrl(r2, command, {
        expiresIn: expiresIn * 60
      });

      logger.debug('Presigned URL generated', {
        r2Ref,
        expiresIn,
        urlLength: url.length
      });

      return url;
    } catch (error) {
      logger.error('Error generating presigned URL', {
        r2Ref,
        error: error.message
      });
      throw error;
    }
  },

  getContentMetadata: async (r2Ref) => {
    try {
      if (!r2Ref || typeof r2Ref !== 'string') {
        throw new Error('r2Ref is required');
      }

      logger.info('Fetching content metadata from R2', { r2Ref });

      const command = new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2Ref
      });

      const object = await r2.send(command);

      const metadata = {
        size: object.ContentLength,
        type: object.ContentType,
        etag: object.ETag,
        lastModified: object.LastModified,
        hash: object.ETag?.replace(/"/g, '') // Remove quotes from ETag
      };

      logger.debug('Content metadata retrieved', {
        r2Ref,
        metadata
      });

      return metadata;
    } catch (error) {
      logger.error('Error fetching content metadata', {
        r2Ref,
        error: error.message
      });
      throw error;
    }
  },

  batchGetPresignedUrls: async (r2Refs, expiresIn = 1440) => {
    try {
      if (!Array.isArray(r2Refs) || r2Refs.length === 0) {
        throw new Error('r2Refs must be a non-empty array');
      }

      logger.info('Generating presigned URLs for batch', {
        count: r2Refs.length,
        expiresIn
      });

      const results = await Promise.allSettled(
        r2Refs.map(ref => this.getPresignedUrl(ref, expiresIn))
      );

      const urls = r2Refs.map((ref, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          return { r2Ref: ref, presignedUrl: result.value };
        } else {
          logger.warn('Failed to generate presigned URL', {
            r2Ref: ref,
            error: result.reason?.message
          });
          return { r2Ref: ref, presignedUrl: null, error: result.reason?.message };
        }
      });

      logger.debug('Batch presigned URLs generated', {
        total: urls.length,
        succeeded: urls.filter(u => u.presignedUrl).length,
        failed: urls.filter(u => !u.presignedUrl).length
      });

      return urls;
    } catch (error) {
      logger.error('Error in batch presigned URL generation', {
        count: r2Refs.length,
        error: error.message
      });
      throw error;
    }
  }
};
