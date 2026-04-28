import { createBlobPhase1Repository } from './blobRepository';
import { createPostgresPhase1Repository } from './postgresRepository';
import type { Phase1Repository, Phase1StorageDriverSetting } from './types';

const VALID_DRIVERS = new Set<Phase1StorageDriverSetting>(['auto', 'blob', 'postgres']);

function getConfiguredDriver(): Phase1StorageDriverSetting {
  const raw = (process.env.PHASE1_STORAGE_DRIVER ?? 'auto').toLowerCase();
  if (VALID_DRIVERS.has(raw as Phase1StorageDriverSetting)) {
    return raw as Phase1StorageDriverSetting;
  }
  return 'auto';
}

export function createPhase1Repository(): Phase1Repository {
  const driver = getConfiguredDriver();

  if (driver === 'blob') {
    return createBlobPhase1Repository();
  }

  if (driver === 'postgres') {
    return createPostgresPhase1Repository();
  }

  // "auto" keeps existing behavior: only use Postgres when fully configured.
  return process.env.DATABASE_URL ? createPostgresPhase1Repository() : createBlobPhase1Repository();
}
