import { site } from "@/lib/site";

/**
 * Single source of truth for marketing navigation.
 * (Dashboard nav lives with its components: components/dashboard/DashboardNav.tsx
 * exports dashboardNavItems.)
 */
export const marketingNav = [
  { href: "/solutions", label: "Solutions" },
  { href: "/automation-builder", label: "Builder" },
  { href: "/contact", label: "Contact" },
] as const;

export type FooterColumn = {
  heading: string;
  links: readonly { href: string; label: string }[];
};

export const footerColumns: readonly FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { href: "/automation-builder", label: "Automation Builder" },
      { href: "/solutions#usecases", label: "Use cases" },
      { href: "/solutions", label: "Solutions" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/login", label: "Log in" },
      { href: "/signup", label: "Sign up" },
    ],
  },
  {
    heading: "Write to us",
    links: [
      { href: `mailto:${site.email}`, label: site.email },
      { href: `mailto:${site.salesEmail}`, label: site.salesEmail },
      { href: `mailto:${site.supportEmail}`, label: site.supportEmail },
    ],
  },
] as const;
