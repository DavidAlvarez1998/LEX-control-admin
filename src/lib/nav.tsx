import type { ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const ic = "h-5 w-5 shrink-0";

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: "/empresas",
    label: "Empresas",
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
        <path d="M15 21V9h3a1 1 0 0 1 1 1v11" />
        <path d="M8 7h2M8 11h2M8 15h2" />
      </svg>
    ),
  },
  {
    href: "/servicios",
    label: "Servicios",
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.7 2.7-2-2 2.7-2.7Z" />
      </svg>
    ),
  },
  {
    href: "/facturacion",
    label: "Facturación",
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2h9l3 3v17l-3-1.5L12 22l-3-1.5L6 22Z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </svg>
    ),
  },
  {
    href: "/api",
    label: "API",
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 8 5 12 9 16" />
        <polyline points="15 8 19 12 15 16" />
        <line x1="13" y1="6" x2="11" y2="18" />
      </svg>
    ),
  },
  {
    href: "/usuarios",
    label: "Usuarios",
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" />
        <path d="M18 20a5.5 5.5 0 0 0-3-4.9" />
      </svg>
    ),
  },
];
