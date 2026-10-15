import type { VariantOptionLabel } from "@/types/domain";

/** "Size: M · Colour: Red" under a cart or checkout line (nothing for a simple product). */
export function VariantOptions({ options }: { options: VariantOptionLabel[] }) {
  if (options.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {options.map((option) => (
        <li key={option.name}>
          {option.name}: <span className="text-foreground">{option.value}</span>
        </li>
      ))}
    </ul>
  );
}
