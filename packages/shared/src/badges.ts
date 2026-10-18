export interface BadgeInput {
  lessonsCompleted: number;
  roadmapsCompleted: number;
  longestStreak: number;
  perfectLessons: number;
  cardsReviewed: number;
  dailyChallenges: number;
  distinctGamesPlayed: number;
  totalGames: number;
  totalMinutes: number;
  labsPassed: number;
  totalLabs: number;
  mocksCompleted: number;
  bestMockScore: number;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  /** e.g. "3 / 7", shown on locked badges. */
  progress: string;
  /** 0..1 */
  ratio: number;
}

const def = (
  id: string,
  title: string,
  description: string,
  value: number,
  target: number,
): Badge => ({
  id,
  title,
  description,
  earned: value >= target,
  progress: `${Math.min(value, target)} / ${target}`,
  ratio: Math.min(1, target === 0 ? 1 : value / target),
});

/** Badges are derived from recorded activity, never stored, so they can't drift from the data. */
export function computeBadges(i: BadgeInput): Badge[] {
  return [
    def('first-lesson', 'First Line of Defense', 'Complete your first lesson', i.lessonsCompleted, 1),
    def('five-lessons', 'Analyst in Training', 'Complete 5 lessons', i.lessonsCompleted, 5),
    def('roadmap', 'Roadmap Finisher', 'Complete every lesson in a roadmap', i.roadmapsCompleted, 1),
    def('perfect', 'Flawless', 'Score 100% on 3 lesson quizzes', i.perfectLessons, 3),
    def('streak-3', 'Warming Up', 'Reach a 3-day streak', i.longestStreak, 3),
    def('streak-7', 'Week Warrior', 'Reach a 7-day streak', i.longestStreak, 7),
    def('streak-30', 'Unbreakable', 'Reach a 30-day streak', i.longestStreak, 30),
    def('cards-50', 'Memory Vault', 'Review 50 flashcards', i.cardsReviewed, 50),
    def('daily-5', 'Daily Defender', 'Finish 5 daily challenges', i.dailyChallenges, 5),
    def('all-games', 'Game Master', 'Play every mini-game', i.distinctGamesPlayed, i.totalGames),
    def('first-lab', 'Lab Rat', 'Pass your first security lab', i.labsPassed, 1),
    def('all-labs', 'Red Team Ready', 'Pass every security lab', i.labsPassed, i.totalLabs),
    def('mock-1', 'Interview Ready', 'Complete a mock interview', i.mocksCompleted, 1),
    def('mock-80', 'Offer Letter', 'Score 80%+ in a mock interview', i.bestMockScore, 80),
    def('hour', 'Dedicated', 'Spend 60 active minutes learning', i.totalMinutes, 60),
  ];
}
