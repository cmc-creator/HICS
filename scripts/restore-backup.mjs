#!/usr/bin/env node
// Restore a NyxHICSlab store backup (see
// ~/workspace/hics-sales-pack/backup-restore-runbook.md).
//
// Backups are timestamped verbatim copies of the single Redis
// store value, written by POST /api/admin/backup under
//   <HICS_STORE_REDIS_KEY>:backup:<ISO timestamp>
// (default main key: nyx:hics:store:v1).
//
// Usage - the Upstash credentials come from the environment,
// exactly as the API reads them; nothing is hardcoded:
//
//   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... \
//     node scripts/restore-backup.mjs --list
//
//   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... \
//     node scripts/restore-backup.mjs 'nyx:hics:store:v1:backup:2026-11-16T12:00:00.000Z' --dry-run
//
//   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... \
//     node scripts/restore-backup.mjs 'nyx:hics:store:v1:backup:2026-11-16T12:00:00.000Z'
//
// --dry-run only reads and reports what a restore WOULD bring
// back; it never writes. A real restore overwrites the live store
// key with the snapshot bytes. Running serverless instances pick
// the restored state up as they recycle (auth-critical handlers
// reload on every call; other handlers may serve their warm cache
// until the instance is replaced), so restore during a quiet
// window and expect a few minutes of mixed reads.

import {
  inspectStoreBackup,
  isBackupSupported,
  listStoreBackups,
  restoreStoreFromBackup,
  STORE_BACKUP_PREFIX,
} from '../api/_store.js';

function fail(message) {
  console.error(`restore-backup: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const listOnly = args.includes('--list');
const key = args.find((arg) => !arg.startsWith('--'));

if (!isBackupSupported()) {
  fail('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set - backups live in the Redis store, so there is nothing to restore without them.');
}

if (listOnly) {
  const backups = await listStoreBackups();
  if (backups.length === 0) {
    console.log('No backups found.');
    process.exit(0);
  }
  console.log(`${backups.length} backup(s), newest first:`);
  for (const backup of backups) {
    console.log(`  ${backup.key}  (${backup.bytes} bytes)`);
  }
  process.exit(0);
}

if (!key) {
  fail(`usage: node scripts/restore-backup.mjs --list | <backup-key> [--dry-run]\nBackup keys start with ${STORE_BACKUP_PREFIX}`);
}

const inspection = await inspectStoreBackup(key).catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
if (!inspection) {
  fail(`no backup found at key: ${key}`);
}

console.log(`Backup:    ${inspection.key}`);
console.log(`Taken at:  ${inspection.timestamp}`);
console.log(`Size:      ${inspection.bytes} bytes`);
console.log(`Contents:  ${inspection.counts.users} users, ${inspection.counts.attempts} attempts, `
  + `${inspection.counts.events} events, ${inspection.counts.auditLogs} audit logs, `
  + `${inspection.counts.leads} leads, ${inspection.counts.progressKeys} progress records, `
  + `${inspection.counts.refreshTokens} refresh sessions`);

if (dryRun) {
  console.log('DRY RUN - no changes made. Re-run without --dry-run to restore this snapshot.');
  process.exit(0);
}

console.log('Restoring this snapshot over the LIVE store key...');
const result = await restoreStoreFromBackup(key);
if (!result) {
  fail('restore failed - the backup disappeared between inspection and restore');
}
console.log('Restore complete. The live store now holds the snapshot bytes.');
console.log('Note: warm serverless instances may serve their cached store until they recycle; auth-critical paths reload immediately.');
