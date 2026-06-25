import { r2 } from "../../config/r2Upload.js";
import logger from "../../config/logger.js";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// In-memory cache for metadata and presigned URLs
const metadataCache = new Map(); // r2Ref -> metadata
const urlCache = new Map(); // `${r2Ref}_${expiresIn}` -> { url, expiresAt }

// Deduplication maps for concurrent requests
const activeMetadataRequests = new Map(); // r2Ref -> Promise
const activeUrlRequests = new Map(); // `${r2Ref}_${expiresIn}` -> Promise
const activeContentRequests = new Map(); // r2Ref -> Promise

export const r2ContentFetcher = {
  fetchTaskContent: async (r2Ref, options = {}) => {
    try {
      if (!r2Ref || typeof r2Ref !== 'string') {
        throw new Error('r2Ref is required and must be a string');
      }

      if (activeContentRequests.has(r2Ref)) {
        logger.debug('Reusing active task content request from R2', { r2Ref });
        return activeContentRequests.get(r2Ref);
      }

      logger.info('Fetching task content from R2', { r2Ref });

      const fetchPromise = (async () => {
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
      })();

      activeContentRequests.set(r2Ref, fetchPromise);

      try {
        const result = await fetchPromise;
        return result;
      } finally {
        activeContentRequests.delete(r2Ref);
      }
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

      const cacheKey = `${r2Ref}_${expiresIn}`;
      const now = Date.now();

      if (urlCache.has(cacheKey)) {
        const cached = urlCache.get(cacheKey);
        if (cached.expiresAt > now) {
          logger.debug('Presigned URL cache hit', { r2Ref, expiresIn });
          return cached.url;
        } else {
          urlCache.delete(cacheKey);
        }
      }

      if (activeUrlRequests.has(cacheKey)) {
        logger.debug('Reusing active presigned URL request', { r2Ref, expiresIn });
        return activeUrlRequests.get(cacheKey);
      }

      logger.debug('Generating presigned URL for R2 content', { r2Ref, expiresIn });

      const requestPromise = (async () => {
        const command = new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: r2Ref
        });

        const url = await getSignedUrl(r2, command, {
          expiresIn: expiresIn * 60
        });

        // Cache for up to 1 hour, or until 5 mins before expiration
        const maxCacheTimeMs = 3600 * 1000; // 1 hour in ms
        const expirationSafetyBufferMs = 300 * 1000; // 5 minutes safety buffer
        const actualExpirationMs = expiresIn * 60 * 1000;
        const cacheDuration = Math.max(0, Math.min(maxCacheTimeMs, actualExpirationMs - expirationSafetyBufferMs));

        urlCache.set(cacheKey, {
          url,
          expiresAt: Date.now() + cacheDuration
        });

        logger.debug('Presigned URL generated and cached', {
          r2Ref,
          expiresIn,
          urlLength: url.length,
          cacheDurationMs: cacheDuration
        });

        return url;
      })();

      activeUrlRequests.set(cacheKey, requestPromise);

      try {
        const result = await requestPromise;
        return result;
      } finally {
        activeUrlRequests.delete(cacheKey);
      }
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

      // Check static metadata cache first
      if (metadataCache.has(r2Ref)) {
        logger.debug('Content metadata cache hit', { r2Ref });
        return metadataCache.get(r2Ref);
      }

      if (activeMetadataRequests.has(r2Ref)) {
        logger.debug('Reusing active content metadata request', { r2Ref });
        return activeMetadataRequests.get(r2Ref);
      }

      logger.info('Fetching content metadata from R2', { r2Ref });

      const requestPromise = (async () => {
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

        metadataCache.set(r2Ref, metadata);

        logger.debug('Content metadata retrieved and cached', {
          r2Ref,
          metadata
        });

        return metadata;
      })();

      activeMetadataRequests.set(r2Ref, requestPromise);

      try {
        const result = await requestPromise;
        return result;
      } finally {
        activeMetadataRequests.delete(r2Ref);
      }
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
        r2Refs.map(ref => r2ContentFetcher.getPresignedUrl(ref, expiresIn))
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
