// A forecast per hour of lessons, from the class's current rates. Every active
// student uses their own hours at the student rate, while the tutor is paid
// once per lesson, however many students there are.
export function classForecast({
  studentRate,
  tutorRate,
  capacity,
  activeStudents,
}: {
  studentRate: number;
  tutorRate: number;
  capacity: number;
  activeStudents: number;
}) {
  const breakEvenStudents = Math.ceil(tutorRate / studentRate);

  return {
    marginNow: activeStudents * studentRate - tutorRate,
    marginWhenFull: capacity * studentRate - tutorRate,
    breakEvenStudents,
    lossWhenFull: breakEvenStudents > capacity,
  };
}

export function formatStudents(count: number) {
  return `${count} ${count === 1 ? "student" : "students"}`;
}
