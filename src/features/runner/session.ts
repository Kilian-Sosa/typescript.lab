import type { InjectionKey } from 'vue';
import type { RunChallenge } from './runChallenge';

export const runChallengeKey: InjectionKey<RunChallenge> = Symbol('runChallenge');
