import crypto from 'crypto';
import logger from '../config/logger.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2 } from '../config/r2Upload.js';

export async function triggerWorker(r2Key, projectId, datasetId, dataType) {
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
  const internalSecret = process.env.INTERNAL_SECRET;

  if (!workerUrl) {
    throw new Error('CLOUDFLARE_WORKER_URL not configured');
  }

  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET not configured');
  }

  const normalizedDataType = String(dataType).toLowerCase().trim();

  let downloadUrl = null;
  try {
    // Generate a presigned GET URL for the R2 file so the worker can download it directly via fetch
    const getCommand = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Key,
    });
    downloadUrl = await getSignedUrl(r2, getCommand, { expiresIn: 3600 }); // 1 hour
    logger.info('Generated presigned download URL for worker', { r2Key, downloadUrlLength: downloadUrl.length });
  } catch (urlError) {
    logger.warn('Failed to generate presigned GET URL for worker', {
      r2Key,
      error: urlError.message,
    });
  }

  const payload = {
    r2Key,
    projectId,
    datasetId,
    dataType: normalizedDataType,
    downloadUrl,
  };

  try {
    logger.info('Triggering Cloudflare Worker', {
      workerUrl,
      projectId,
      datasetId,
      dataType: normalizedDataType,
      r2Key,
    });

    logger.info('Fetch request details', {
      url: workerUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vera-Signature': internalSecret,
      },
      payloadKeys: Object.keys(payload),
    });

    let response;
    try {
      response = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vera-Signature': internalSecret,
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchError) {
      const fetchErrorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      const fetchErrorCode = fetchError?.code || 'UNKNOWN';
      logger.error('Fetch network error', {
        error: fetchErrorMsg,
        code: fetchErrorCode,
        url: workerUrl,
        projectId,
        datasetId,
        type: fetchError?.constructor?.name,
      });
      throw new Error(`Network error calling worker at ${workerUrl}: ${fetchErrorMsg}`);
    }

    logger.info(`Worker response received with status code: ${response.status} ${response.statusText}`);

    let responseData;
    try {
      responseData = await response.json();
    } catch (jsonError) {
      logger.error('Failed to parse response JSON', {
        status: response.status,
        error: jsonError instanceof Error ? jsonError.message : String(jsonError),
      });
      throw new Error(`Failed to parse worker response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
    }

    logger.info(`Parsed response data: ${JSON.stringify(responseData)}`);

    if (!response.ok) {
      // 502 = worker processed the file but some task batches failed to register
      // The dataset record and R2 file are already updated — don't 500 the user
      if (response.status === 502) {
        logger.warn('Worker completed with partial batch failures', {
          projectId,
          datasetId,
          failedBatches: responseData.failedBatches,
          count: responseData.count,
        });
        return { ...responseData, partialSuccess: true };
      }

      const errorMsg = `Worker returned ${response.status}: ${responseData.message || JSON.stringify(responseData)}`;
      logger.error(`WORKER ERROR - Status ${response.status}: ${errorMsg}`);
      logger.error('Full error response:', responseData);
      throw new Error(errorMsg);
    }

    logger.info('Worker triggered successfully', {
      projectId,
      datasetId,
      response: responseData,
    });

    return responseData;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    logger.error('Failed to trigger worker', {
      error: errorMsg,
      stack: errorStack,
      projectId,
      datasetId,
      r2Key,
      workerUrl,
    });
    throw error;
  }
}
