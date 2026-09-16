import type { FeatureContext } from '../core/feature-context';

export interface FeatureModule {
  id: string;
  label: string;
  mount(container: HTMLElement, context: FeatureContext): void | Promise<void>;
  unmount?(container: HTMLElement, context: FeatureContext): void | Promise<void>;
}

export class FeatureRegistry {
  private readonly modules = new Map<string, FeatureModule>();

  constructor(private readonly context: FeatureContext) {}

  register(module: FeatureModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Feature already registered: ${module.id}`);
    }
    this.modules.set(module.id, module);
  }

  get(id: string): FeatureModule | undefined {
    return this.modules.get(id);
  }

  mount(id: string, container: HTMLElement): Promise<void> {
    const module = this.modules.get(id);
    if (!module) return Promise.reject(new Error(`Unknown feature: ${id}`));
    return Promise.resolve().then(() => module.mount(container, this.context));
  }

  unmount(id: string, container: HTMLElement): Promise<void> {
    const module = this.modules.get(id);
    if (!module?.unmount) return Promise.resolve();
    return Promise.resolve(module.unmount(container, this.context));
  }
}