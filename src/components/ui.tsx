"use client";

import type { CSSProperties, ReactNode } from "react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatMoney, parseMoneyInput } from "@/lib/format";

/**
 * Input de precio: muestra el valor con separador de miles de punto
 * (1.000.000) mientras se escribe y entrega solo dígitos por `onChange`.
 * `value` es la cadena de solo dígitos almacenada en el formulario.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const display = value === "" ? "" : formatMoney(value);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => onChange(parseMoneyInput(e.target.value))}
      placeholder={placeholder}
      className={className}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const styles =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent-hover"
      : variant === "danger"
        ? "bg-red-600 text-white hover:bg-red-500"
        : "border border-line bg-subtle text-foreground hover:bg-hover";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface p-4 sm:p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Tooltip reutilizable (estándar del proyecto — preferir sobre el atributo `title`).
 * Envuelve cualquier `children` y muestra `content` al hover o al enfocar con teclado
 * (accesible: `role="tooltip"`). Portal a `document.body` + `position: fixed` + z-index
 * alto para que NO lo tape el sidebar/topbar. No bloquea clics. Retardo ~700ms.
 * Mantener idéntico al de lex-control-client (mismo estándar `ui-tooltip`).
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className = "",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; transform: string } | null>(null);

  function place() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const gap = 8;
    const map = {
      top: { top: r.top - gap, left: r.left + r.width / 2, transform: "translate(-50%, -100%)" },
      bottom: { top: r.bottom + gap, left: r.left + r.width / 2, transform: "translate(-50%, 0)" },
      left: { top: r.top + r.height / 2, left: r.left - gap, transform: "translate(-100%, -50%)" },
      right: { top: r.top + r.height / 2, left: r.right + gap, transform: "translate(0, -50%)" },
    } as const;
    setPos(map[side]);
  }
  function open() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      place();
      setShow(true);
    }, 700);
  }
  function close() {
    if (timer.current) clearTimeout(timer.current);
    setShow(false);
  }

  const estilo: CSSProperties = pos
    ? { position: "fixed", top: pos.top, left: pos.left, transform: pos.transform, zIndex: 1000 }
    : {};

  return (
    <span
      ref={ref}
      className={`relative inline-flex ${className}`}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      {children}
      {show && pos && typeof document !== "undefined" &&
        createPortal(
          <span
            role="tooltip"
            style={estilo}
            className="pointer-events-none w-max max-w-xs whitespace-normal rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-normal leading-snug text-white shadow-lg dark:bg-slate-700"
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{hint}</p>}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-hover text-muted">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      </div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Modal centrado con overlay. Cierra al clic fuera. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  if (!open || typeof document === "undefined") return null;
  const max = size === "lg" ? "max-w-2xl" : "max-w-md";
  // Portal a <body>: el overlay `fixed` debe medirse contra el viewport. Si se
  // renderiza dentro del árbol, cualquier ancestro con `transform`/`will-change`
  // (p. ej. el contenedor de página animado) lo confinaría a su caja → el overlay
  // solo oscurece el recuadro de contenido y queda tapado por el topbar.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className={`max-h-[90vh] w-full ${max} overflow-y-auto`}>
        <h3 className="mb-4 text-lg font-semibold text-foreground">{title}</h3>
        <div className="space-y-3">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </Card>
    </div>,
    document.body,
  );
}

/** Campo con label (asterisco rojo si requerido). Inputs nativos con la clase `inputCls`. */
export const inputCls =
  "mt-1 w-full rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent";

export function Field({
  label,
  requerido = false,
  children,
}: {
  label: string;
  requerido?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-foreground">
        {label}
        {requerido && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
