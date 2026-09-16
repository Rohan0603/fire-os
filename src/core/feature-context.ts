import { appState } from '../lib/appState';
import type { FireOSState } from '../types/state';
import { createFeaturePorts, type FeaturePorts } from './feature-ports';
import {
  createPortfolioRepository,
  type PortfolioRepository,
} from './persistence/portfolio-repository';

export interface FeatureContext {
  state: FireOSState;
  portfolio: PortfolioRepository;
  ports: FeaturePorts;
}

export function createFeatureContext(
  state: FireOSState = appState,
  portfolio: PortfolioRepository = createPortfolioRepository(),
  ports: FeaturePorts = createFeaturePorts(),
): FeatureContext {
  return { state, portfolio, ports };
}