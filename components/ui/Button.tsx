import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
};

const sizeClass: Record<Size, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
};

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function classes(variant: Variant, size: Size, className: string) {
  return [variantClass[variant], sizeClass[size], className]
    .filter(Boolean)
    .join(" ");
}

/**
 * The one button. Emits the design-system classes from globals.css, so class
 * usage (legacy) and this primitive share a single style source.
 *
 * Nocturne rule: the primary action is an accent outline — never a fill.
 */
export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const {
      variant = "primary",
      size = "md",
      className = "",
      href,
      ...rest
    } = props;
    return (
      <Link
        href={href}
        {...rest}
        className={classes(variant, size, className)}
      />
    );
  }

  const {
    variant = "primary",
    size = "md",
    className = "",
    type = "button",
    ...rest
  } = props;
  return (
    <button
      type={type}
      {...rest}
      className={classes(variant, size, className)}
    />
  );
}
