/**
 * @file ArtifactJob
 * @description Runs an Artifact replacement request supplied by Manager or Scheduler.
 */
import { ArtifactService } from '../../Artifact/ArtifactService';
import type { Job } from '../Job';

class ArtifactJob implements Job {
  readonly name = 'artifact' as const;

  constructor(private readonly configPath: string) {}

  async run(signal: AbortSignal, payload?: unknown): Promise<boolean> {
    if (signal.aborted) return false;
    const ids = Array.isArray(payload) ? payload.filter((id): id is number => Number.isInteger(id)) : [];
    if (ids.length === 0) throw new Error('Artifact IDs are required');
    const service = new ArtifactService(this.configPath);
    if (!service.initted) return false;
    if (!await service.init() || signal.aborted) return false;
    return service.start(ids);
  }
}

export { ArtifactJob };
