type ContentCardProps = {
  title: string;
  description: string;
  className?: string;
};

export function ContentCard({ title, description, className = "" }: ContentCardProps) {
  return (
    <article className={`bubble p-5 sm:p-6 ${className}`.trim()}>
      <h3 className="text-base font-semibold text-[var(--text)] sm:text-lg">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">{description}</p>
    </article>
  );
}
