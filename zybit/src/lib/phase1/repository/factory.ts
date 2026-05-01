import { createPostgresPhase1Repository } from './postgresRepository';
import type { Phase1Repository } from './types';

export function createPhase1Repository(): Phase1Repository {
  return createPostgresPhase1Repository();
}
