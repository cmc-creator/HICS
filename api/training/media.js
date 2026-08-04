import { appendAuditLog, createId, getStore, json, saveStore } from '../_store.js';
import { canManageData, isEnterpriseAdmin, requireAuth, scopeByFacility } from '../_auth.js';
import { authorizeEndpoint } from '../_policy.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';

const MAX_DATA_URL_LENGTH = 8 * 1024 * 1024;

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (!enforceRateLimit(req, res, {
    scope: 'training-media',
    maxRequests: 120,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (!authorizeEndpoint(res, 'TRAINING_MEDIA', req.method, auth.claims)) {
    return;
  }

  const store = await getStore();
  const requesterFacility = String(auth.claims.facility || 'all');

  if (!Array.isArray(store.mediaAssets)) {
    store.mediaAssets = [];
  }

  if (req.method === 'GET') {
    const moduleId = typeof req.query?.moduleId === 'string' ? req.query.moduleId : '';

    let scoped = scopeByFacility(store.mediaAssets, auth.claims, 'facility');
    if (moduleId) {
      scoped = scoped.filter((item) => String(item.moduleId || '') === moduleId);
    }

    return json(res, 200, { mediaAssets: scoped.slice(0, 250) });
  }

  if (req.method === 'POST') {
    const body = parseJsonBody(req);
    if (!body || typeof body !== 'object') {
      return json(res, 400, { error: 'Invalid JSON payload' });
    }

    const validationError = validateBodyFields(body, [
      { name: 'moduleId', required: true, type: 'string', minLength: 2, maxLength: 120 },
      { name: 'title', required: true, type: 'string', minLength: 2, maxLength: 140 },
      { name: 'sourceType', required: true, type: 'string', minLength: 5, maxLength: 10 },
      { name: 'videoUrl', required: true, type: 'string', minLength: 10, maxLength: MAX_DATA_URL_LENGTH },
      { name: 'posterUrl', required: false, type: 'string', maxLength: 500 },
      { name: 'description', required: false, type: 'string', maxLength: 300 },
      { name: 'storageKey', required: false, type: 'string', maxLength: 400 },
      { name: 'storageProvider', required: false, type: 'string', maxLength: 40 },
    ]);
    if (validationError) {
      return json(res, 400, { error: validationError });
    }

    const sourceType = String(body.sourceType);
    if (sourceType !== 'stream' && sourceType !== 'upload') {
      return json(res, 400, { error: 'sourceType must be stream or upload' });
    }

    const videoUrl = String(body.videoUrl);
    if (sourceType === 'upload') {
      const isDataUrl = videoUrl.startsWith('data:video/');
      const isHttpUrl = isValidHttpUrl(videoUrl);

      if (!isDataUrl && !isHttpUrl) {
        return json(res, 400, { error: 'Uploaded media must be a video data URL or object URL' });
      }

      if (isDataUrl && videoUrl.length > MAX_DATA_URL_LENGTH) {
        return json(res, 413, { error: 'Uploaded media exceeds maximum allowed size' });
      }
    }

    if (sourceType === 'stream' && !isValidHttpUrl(videoUrl)) {
      return json(res, 400, { error: 'videoUrl must be a valid http(s) stream URL' });
    }

    const facility = isEnterpriseAdmin(auth.claims) && typeof body.facility === 'string' && body.facility
      ? body.facility
      : requesterFacility;

    const asset = {
      id: createId('media'),
      moduleId: String(body.moduleId),
      title: String(body.title),
      sourceType,
      videoUrl,
      posterUrl: typeof body.posterUrl === 'string' ? body.posterUrl : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      durationSeconds: Number(body.durationSeconds ?? 0),
      mimeType: typeof body.mimeType === 'string' ? body.mimeType : undefined,
      bytes: Number(body.bytes ?? 0),
      storageKey: typeof body.storageKey === 'string' ? body.storageKey : undefined,
      storageProvider: typeof body.storageProvider === 'string' ? body.storageProvider : undefined,
      facility,
      uploadedBy: String(auth.claims.email || 'unknown@nyxhicslab.local'),
      organization: String(auth.claims.organization || 'Enterprise Health System'),
      createdAt: new Date().toISOString(),
    };

    store.mediaAssets.unshift(asset);
    store.mediaAssets = store.mediaAssets.slice(0, 1200);
    appendAuditLog(store, 'learning_media_uploaded', {
      moduleId: asset.moduleId,
      facility: asset.facility,
      sourceType: asset.sourceType,
      uploadedBy: asset.uploadedBy,
    });

    await saveStore(store);
    return json(res, 201, { mediaAsset: asset });
  }

  if (req.method === 'DELETE') {
    if (!canManageData(auth.claims)) {
      return json(res, 403, { error: 'Forbidden' });
    }

    const id = typeof req.query?.id === 'string' ? req.query.id : '';
    if (!id) {
      return json(res, 400, { error: 'id query parameter is required' });
    }

    const beforeCount = store.mediaAssets.length;
    if (isEnterpriseAdmin(auth.claims) || requesterFacility === 'all') {
      store.mediaAssets = store.mediaAssets.filter((item) => item.id !== id);
    } else {
      store.mediaAssets = store.mediaAssets.filter((item) => !(item.id === id && String(item.facility || '') === requesterFacility));
    }

    if (store.mediaAssets.length === beforeCount) {
      return json(res, 404, { error: 'Media asset not found' });
    }

    appendAuditLog(store, 'learning_media_deleted', { id });
    await saveStore(store);
    return json(res, 204, {});
  }

  return json(res, 405, { error: 'Method not allowed' });
}
