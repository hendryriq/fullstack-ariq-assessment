type UpcomingLesson = {
  starts_at: string;
  duration_minutes: number | null;
};

// Takes the lessons in time order, the way they will use up the balance. It
// starts from the raw balance because overdrawn time is a debt, and every
// lesson after the first uncovered one stays uncovered.
export function forecastHours(
  balanceMinutes: number,
  lessons: UpcomingLesson[],
) {
  let minutesAfter = balanceMinutes;
  let uncovered = 0;
  let firstUncoveredAt: string | null = null;

  for (const lesson of lessons) {
    minutesAfter -= lesson.duration_minutes ?? 0;

    if (minutesAfter < 0) {
      uncovered += 1;
      firstUncoveredAt ??= lesson.starts_at;
    }
  }

  return { total: lessons.length, uncovered, firstUncoveredAt, minutesAfter };
}
