// Create or update a NyxHICSlab account directly in the API store.
//
//   node scripts/create-user.mjs --email ops@hospital.org --name "Ops Lead" \
//     --role enterprise-admin [--facility all] [--password]
//
// Point it at production by exporting UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// first; without them it writes the local development store file.
// --password prompts for a password (needed only when ALLOW_LOCAL_AUTH_FALLBACK=true;
// SSO users don't need one). NEW_USER_PASSWORD can supply it non-interactively.

import readline from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { appendAuditLog, createId, updateStore } from '../api/_store.js';
import { ROLES, hashPassword, isValidEmail, normalizeEmail } from '../api/_users.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string' },
    facility: { type: 'string' },
    organization: { type: 'string' },
    password: { type: 'boolean', default: false },
  },
});

function fail(message) {
  console.error(`create-user: ${message}`);
  process.exit(1);
}

const email = normalizeEmail(values.email);
if (!isValidEmail(email)) fail('--email is required and must be a valid address');
if (!values.name) fail('--name is required');
if (!ROLES.includes(values.role)) fail(`--role must be one of: ${ROLES.join(', ')}`);

const facility = values.role === 'enterprise-admin' ? 'all' : values.facility;
if (!facility) fail('--facility is required for roles other than enterprise-admin');

let passwordHash;
if (values.password) {
  let password = process.env.NEW_USER_PASSWORD;
  if (!password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question('Password (min 12 characters): ');
    rl.close();
  }
  if (!password || password.length < 12) fail('password must be at least 12 characters');
  passwordHash = hashPassword(password);
}

const result = await updateStore((store) => {
  const existing = store.users.find((user) => normalizeEmail(user.email) === email);
  const user = existing ?? { id: createId('usr'), createdAt: new Date().toISOString() };

  Object.assign(user, {
    email,
    fullName: values.name,
    role: values.role,
    facility,
    organization: values.organization || user.organization || process.env.DEFAULT_ORGANIZATION_NAME || 'Enterprise Health System',
    status: 'active',
    ...(passwordHash ? { passwordHash } : {}),
  });

  if (!existing) {
    store.users.unshift(user);
  }
  appendAuditLog(store, existing ? 'admin_user_updated_cli' : 'admin_user_created_cli', {
    userId: user.id,
    role: user.role,
    facility: user.facility,
  });
  return { created: !existing, id: user.id };
});

console.log(`${result.created ? 'Created' : 'Updated'} ${email} (${values.role}, ${facility}) as ${result.id}`);
