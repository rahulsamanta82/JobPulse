import { JobSourceAdapter } from './types';
import { AdzunaSourceAdapter } from './AdzunaSourceAdapter';
import { RemotiveAdapter } from './remotiveAdapter';
import { WeWorkRemotelyAdapter } from './weWorkRemotelyAdapter';
import { JobicyAdapter } from './jobicyAdapter';
import { SandboxAdapter } from './sandboxAdapter';

class SourceRegistry {
  private adapters: Map<string, JobSourceAdapter> = new Map();

  constructor() {
    this.register(new AdzunaSourceAdapter());
    this.register(new RemotiveAdapter());
    this.register(new WeWorkRemotelyAdapter());
    this.register(new JobicyAdapter());
    this.register(new SandboxAdapter());
  }

  register(adapter: JobSourceAdapter): void {
    this.adapters.set(adapter.id.toLowerCase(), adapter);
  }

  getAdapter(sourceId: string): JobSourceAdapter | undefined {
    return this.adapters.get(sourceId.toLowerCase());
  }

  getAllAdapters(): JobSourceAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const sourceRegistry = new SourceRegistry();
