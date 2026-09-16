import { appState } from '../lib/appState';
import type { FireOSState } from '../types/state';
import { createFeaturePorts, type FeaturePorts } from './feature-ports';
import {
  createPortfolioRepository,
  type PortfolioRepository,
} from './persistence/portfolio-repository';

export interface FeatureEventMap {
  portfolioChanged: FireOSState;
  refreshRequested: { featureId: string };
}

export interface FeatureEventBus {
  emit<EventName extends keyof FeatureEventMap>(eventName: EventName, payload: FeatureEventMap[EventName]): void;
  on<EventName extends keyof FeatureEventMap>(
    eventName: EventName,
    listener: (payload: FeatureEventMap[EventName]) => void,
  ): () => void;
}

export interface FeatureContext {
  state: FireOSState;
  portfolio: PortfolioRepository;
  ports: FeaturePorts;
  events: FeatureEventBus;
}

export function createFeatureContext(
  state: FireOSState = appState,
  portfolio: PortfolioRepository = createPortfolioRepository(),
  ports: FeaturePorts = createFeaturePorts(),
  events: FeatureEventBus = createFeatureEventBus(),
): FeatureContext {
  return { state, portfolio, ports, events };
}

export function createFeatureEventBus(): FeatureEventBus {
  const listeners = new Map<keyof FeatureEventMap, Set<(payload: never) => void>>();

  return {
    emit(eventName, payload) {
      listeners.get(eventName)?.forEach(listener => listener(payload as never));
    },
    on(eventName, listener) {
      const eventListeners = listeners.get(eventName) || new Set<(payload: never) => void>();
      eventListeners.add(listener as (payload: never) => void);
      listeners.set(eventName, eventListeners);
      return () => eventListeners.delete(listener as (payload: never) => void);
    },
  };
}