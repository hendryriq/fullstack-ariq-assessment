export type LogbookEntryText = {
  activities: string;
  tutor_observation: string;
  future_recommendation: string;
};

export function LogbookEntryFields({ entry }: { entry: LogbookEntryText }) {
  return (
    <dl className="flex flex-col gap-3 text-sm">
      <EntryField label="Activities" value={entry.activities} />
      <EntryField label="Tutor observation" value={entry.tutor_observation} />
      <EntryField
        label="Future recommendation"
        value={entry.future_recommendation}
      />
    </dl>
  );
}

function EntryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-muted">{label}</dt>
      <dd className="whitespace-pre-line">{value}</dd>
    </div>
  );
}
