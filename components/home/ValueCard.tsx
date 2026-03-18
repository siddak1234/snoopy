import type { ReactNode } from "react";

type ValueCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
};

export default function ValueCard({ title, description, icon }: ValueCardProps) {
  return (
    <article
      tabIndex={0}
      className="interactive-card bubble group p-5 focus-visible:-translate-y-1 focus-visible:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9ec4ff] sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="transition duration-200 group-hover:scale-105 group-focus-visible:scale-105">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">{description}</p>
    </article>
  );
}
