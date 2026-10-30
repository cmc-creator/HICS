import { handleUpload } from '@vercel/blob';
import { requireAuth } from '../../_auth.js';
import { authorizeEndpoint } from '../../_policy.js';
import { enforceRateLimit, parseJsonBody } from '../../_security.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vercel Blob calls this endpoint twice:
  //   1. blob.generate-client-token  - from the user's browser (requires auth)
  //   2. blob.upload-completed       - server-to-server from Vercel Blob infra
  //                                    (handleUpload verifies this via BLOB_READ_WRITE_TOKEN)
  const body = req.body ?? parseJsonBody(req);
  const isUploadCallback = body?.type === 'blob.upload-completed';

  if (!isUploadCallback) {
    if (!await enforceRateLimit(req, res, {
      scope: 'training-media-upload-url',
      maxRequests: 80,
      windowMs: 5 * 60 * 1000,
    })) {
      return;
    }

    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    if (!authorizeEndpoint(res, 'TRAINING_MEDIA', 'POST', auth.claims)) {
      return;
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname) => ({
        allowedContentTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg'],
        maximumSizeInBytes: Number(process.env.MEDIA_UPLOAD_MAX_BYTES || 250 * 1024 * 1024),
      }),
      onUploadCompleted: async () => {
        // Media metadata is saved by the client after upload() resolves.
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('blob upload handshake failed', error);
    return res.status(400).json({ error: 'Upload could not be authorized. Check the file type and size and try again.' });
  }
}