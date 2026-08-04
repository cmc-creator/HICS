import { hasRole } from './_auth.js';

const POLICY = {
  ADMIN_USERS: {
    GET: ['enterprise-admin', 'facility-admin'],
    POST: ['enterprise-admin', 'facility-admin'],
  },
  TRAINING_ATTEMPTS: {
    GET: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'],
    POST: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'],
    DELETE: ['enterprise-admin', 'facility-admin', 'training-manager'],
  },
  TRAINING_EVENTS: {
    GET: ['enterprise-admin', 'facility-admin', 'training-manager'],
    POST: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'],
    DELETE: ['enterprise-admin', 'facility-admin', 'training-manager'],
  },
  TRAINING_PROGRESS: {
    GET: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'],
    PUT: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'],
    DELETE: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'],
  },
  TRAINING_MEDIA: {
    GET: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'],
    POST: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator'],
    DELETE: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator'],
  },
  LIVE_DRILLS: {
    GET: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'],
    PUT: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator'],
    DELETE: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator'],
  },
  RAPID_CHALLENGE: {
    GET: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'],
    POST: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'],
    DELETE: ['enterprise-admin', 'facility-admin', 'training-manager'],
  },
  AUDIT_LOGS: {
    GET: ['enterprise-admin', 'facility-admin', 'training-manager'],
    POST: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'],
  },
  NOTIFICATIONS_SEND: {
    POST: ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'],
  },
};

export function authorizeEndpoint(res, endpoint, method, claims) {
  const endpointPolicy = POLICY[endpoint];
  if (!endpointPolicy) {
    res.status(500).json({ error: `Missing authorization policy for ${endpoint}` });
    return false;
  }

  const allowedRoles = endpointPolicy[method];
  if (!allowedRoles) {
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }

  if (!hasRole(claims, allowedRoles)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }

  return true;
}
