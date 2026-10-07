/** Centred, uppercase section title with a short rule underneath. */
export function SectionHeading({
  id,
  title,
  subtitle,
  as: Heading = "h2",
}: {
  /** Used by the section's aria-labelledby. */
  id: string;
  title: string;
  subtitle?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className="text-center">
      <Heading id={id} className="caps text-xs font-medium sm:text-[0.8125rem]">
        {title}
      </Heading>
      <span aria-hidden className="mx-auto mt-4 block h-px w-4 bg-current" />
      {subtitle && (
        <p className="mx-auto mt-5 max-w-xl text-sm text-pretty text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  );
}
