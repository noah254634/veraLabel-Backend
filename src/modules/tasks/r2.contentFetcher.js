import { r2 } from "../../config/r2Upload.js";
import logger from "../../config/logger.js";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * R2 CONTENT FETCHER SERVICE
 * 
 * Used to fetch actual task content from R2 by reference.
 * Never store raw content in DB - always use R2 references.
 * 
 * Pattern:
 * - Task stored in DB has: r2_input_taskRef (path/reference)
 * - When you need content: r2ContentFetcher.fetchTaskContent(task.r2_input_taskRef)
 * - Use presigned URLs for temporary access without storing content
 */

export const r2ContentFetcher = {
  /**
   * Fetch task content from R2 by reference
   * @param {string} r2Ref - R2 reference path (e.g., 'projects/proj1/dataset1/task1.json')
   * @param {object} options - { expiresIn, format }
   * @returns {Promise<Buffer|string>} - Raw content from R2
   */
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

  /**
   * Get presigned URL for temporary content access (cache in-memory, not in DB)
   * @param {string} r2Ref - R2 reference path
   * @param {number} expiresIn - Minutes until URL expires (default 24 hours)
   * @returns {Promise<string>} - Presigned URL
   */
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

  /**
   * Parse task content and extract metadata (size, type, etc)
   * WITHOUT storing raw content
   * @param {string} r2Ref - R2 reference
   * @returns {Promise<object>} - Metadata only
   */
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

  /**
   * Batch fetch presigned URLs for multiple tasks (cache the URLs, not content)
   * @param {Array<string>} r2Refs - Array of R2 references
   * @param {number} expiresIn - Minutes until URLs expire
   * @returns {Promise<Array>} - Array of { r2Ref, presignedUrl }
   */
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

/**
 * USAGE EXAMPLES:
 * 
 * // Get content when labeler needs to work on task
 * const content = await r2ContentFetcher.fetchTaskContent(task.r2_input_taskRef);
 * 
 * // Get presigned URL for frontend (don't store in DB)
 * const url = await r2ContentFetcher.getPresignedUrl(task.r2_input_taskRef);
 * // Use this URL temporarily, it expires after TTL
 * 
 * // Get metadata for validation
 * const meta = await r2ContentFetcher.getContentMetadata(task.r2_input_taskRef);
 * task.resultMetadata = { size: meta.size, hash: meta.hash, uploadedAt: new Date() };
 * 
 * // Batch fetch for UI display
 * const taskUrls = await r2ContentFetcher.batchGetPresignedUrls(
 *   task.map(t => t.r2_input_taskRef)
 * );
 */
