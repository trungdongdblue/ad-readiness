import type { Finding, Observation, Phase } from '../../domain/types';

export const reached = (obs: Observation, phase: Phase): boolean => obs.phases.some((p) => p.phase === phase && p.reached);

export const phaseNote = (obs: Observation, phase: Phase): string =>
  obs.phases.find((p) => p.phase === phase)?.note ?? 'step not executed';

export const finding = (f: Finding): Finding => f;
