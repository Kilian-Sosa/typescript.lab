import type { ChallengeSummary, Difficulty } from '../../../shared/contracts/v1';

export const challengeRegistry: readonly ChallengeSummary[] = [];

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
