import type { HTMLAttributes } from "react";

type TagProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "accent" | "neutral" | "outline";
};

const variantClass = {
  accent: "tag tag-accent",
  neutral: "tag tag-neutral",
  outline: "tag tag-outline",
} as const;

/** Small label tinted from the ramps (Nocturne .tag). */
export function Tag({ variant = "accent", className = "", ...rest }: TagProps) {
  return (
    <span
      {...rest}
      className={`${variantClass[variant]} ${className}`.trim()}
    />
  );
}
