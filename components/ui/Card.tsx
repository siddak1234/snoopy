import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  /** Rendered element. Defaults to div. */
  as?: "div" | "article" | "section" | "li";
  /** Adds the hover-lift + accent-border treatment. */
  interactive?: boolean;
  /** Padding preset: none for media cards that manage their own padding. */
  padding?: "none" | "sm" | "md" | "lg";
};

const paddingClass = {
  none: "",
  sm: "p-4 sm:p-5",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
} as const;

/**
 * The one surface card (.bubble in globals.css, Nocturne voice: 14px radius,
 * flat surface, hairline border). Absorbs the pre-revamp ContentCard /
 * ValueCard / IconCard variants.
 */
export function Card({
  as: Tag = "div",
  interactive = false,
  padding = "md",
  className = "",
  ...rest
}: CardProps) {
  const classes = [
    "bubble",
    interactive ? "interactive-card" : "",
    paddingClass[padding],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <Tag {...rest} className={classes} />;
}
