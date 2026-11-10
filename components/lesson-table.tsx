import type { ReactNode } from "react";
import { Card, StatusBadge, Table, type Status } from "@/components/ui";
import { formatDuration, formatLessonTime } from "@/lib/format";

export type LessonRow = {
  id: string;
  class_id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number | null;
  status: string;
  cancel_reason: string | null;
};

// A titled list of lessons. Pages pass renderActions to add a column of actions.
export function LessonTable<Lesson extends LessonRow>({
  title,
  emptyText,
  lessons,
  titleById,
  renderActions,
}: {
  title: string;
  emptyText: string;
  lessons: Lesson[];
  titleById: Map<string, string>;
  renderActions?: (lesson: Lesson) => ReactNode;
}) {
  return (
    <Card>
      <h2 className="mb-4 font-semibold">{title}</h2>
      {lessons.length === 0 ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Time</th>
              <th>Duration</th>
              <th>Status</th>
              {renderActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {lessons.map((lesson) => (
              <tr key={lesson.id} className="align-top">
                <td className="font-medium">{titleById.get(lesson.class_id)}</td>
                <td className="whitespace-nowrap">
                  {formatLessonTime(lesson.starts_at, lesson.ends_at)}
                </td>
                <td className="whitespace-nowrap">
                  {formatDuration(lesson.duration_minutes ?? 0)}
                </td>
                <td>
                  <StatusBadge status={lesson.status as Status} />
                  {lesson.cancel_reason && (
                    <p className="mt-1 text-muted">{lesson.cancel_reason}</p>
                  )}
                </td>
                {renderActions && <td>{renderActions(lesson)}</td>}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
