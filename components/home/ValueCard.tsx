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
      className="bubble p-5 transition duration-200 hover:-translate-y-1 hover:shadow-xl focus-visible:-translate-y-1 focus-visible:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9ec4ff] sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {icon}
        <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">{description}</p>
    </article>
  );
}
