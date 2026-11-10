import { Field, Select } from "@/components/ui";
import { formatRupiah } from "@/lib/format";

const PACKAGE_HOURS = [6, 12, 24];

// The price shown here is only a guide. The database sets the invoice amount.
export function PackageField({ rate }: { rate: number }) {
  return (
    <Field label="Package">
      <Select name="hours" required defaultValue="12">
        {PACKAGE_HOURS.map((hours) => (
          <option key={hours} value={hours}>
            {hours} hours, {formatRupiah(hours * rate)}
          </option>
        ))}
      </Select>
    </Field>
  );
}
