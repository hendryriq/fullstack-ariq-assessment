import { Field, Input, Select, Textarea } from "@/components/ui";
import { MAX_LENGTH } from "@/lib/limits";

type ClassValues = {
  title: string;
  description: string;
  capacity: number;
  tutorId: string;
  studentRate: number;
  tutorRate: number;
};

// The same fields are used to create and to edit a class.
export function ClassFields({
  tutors,
  values,
}: {
  tutors: { id: string; full_name: string }[];
  values?: ClassValues;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Title">
        <Input
          name="title"
          required
          maxLength={MAX_LENGTH.classTitle}
          defaultValue={values?.title}
        />
      </Field>
      <Field label="Assigned tutor">
        <Select name="tutor_id" required defaultValue={values?.tutorId ?? ""}>
          <option value="" disabled>
            Choose a tutor
          </option>
          {tutors.map((tutor) => (
            <option key={tutor.id} value={tutor.id}>
              {tutor.full_name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Student rate per hour (Rp)">
        <Input
          name="student_rate"
          type="number"
          min={1}
          step={1}
          required
          defaultValue={values?.studentRate}
        />
      </Field>
      <Field label="Tutor rate per hour (Rp)">
        <Input
          name="tutor_rate"
          type="number"
          min={1}
          step={1}
          required
          defaultValue={values?.tutorRate}
        />
      </Field>
      <Field label="Capacity">
        <Input
          name="capacity"
          type="number"
          min={1}
          max={50}
          step={1}
          required
          defaultValue={values?.capacity}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description">
          <Textarea
            name="description"
            rows={3}
            maxLength={MAX_LENGTH.classDescription}
            defaultValue={values?.description}
          />
        </Field>
      </div>
    </div>
  );
}
