import Image from "next/image";
import mark from "@/public/a8x-mark.png";

/**
 * Official Autom8x mark — the design project's assets/a8x-mark.png.
 * White artwork on transparency, drawn for the dark ground; the light theme
 * inverts it (html[data-theme="light"] .brand-mark in globals.css).
 */
export default function LogoMark({
  height = 22,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src={mark}
      alt=""
      aria-hidden
      className={`brand-mark ${className}`.trim()}
      style={{ height, width: "auto" }}
    />
  );
}
