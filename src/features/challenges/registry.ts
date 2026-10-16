import type { ChallengeDefinition, ChallengeSummary, Difficulty } from '../../../shared/contracts/v1';
import { longestWindowChallenge } from '../../../challenges/longest-window/metadata';

export const challengeDefinitions: readonly ChallengeDefinition[] = [longestWindowChallenge];
export const challengeRegistry: readonly ChallengeSummary[] = challengeDefinitions;

export function filterChallenges(
  challenges: readonly ChallengeSummary[],
  query = '',
  difficulty?: Difficulty,
): ChallengeSummary[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return challenges.filter((challenge) => {
    const matchesDifficulty = difficulty === undefined || challenge.difficulty === difficulty;
    const searchableText = [challenge.title, challenge.objective, ...challenge.tags]
      .join(' ')
      .toLocaleLowerCase();
    const matchesQuery = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);

    return matchesDifficulty && matchesQuery;
  });
}

export function listChallenges(
  query = '',
  difficulty?: Difficulty,
): ChallengeSummary[] {
  return filterChallenges(challengeRegistry, query, difficulty);
}

export function findChallenge(slug: string): ChallengeSummary | undefined {
  return challengeRegistry.find((challenge) => challenge.slug === slug);
}

export function getChallenge(slug: string): ChallengeDefinition | undefined {
  return challengeDefinitions.find((challenge) => challenge.slug === slug);
}
