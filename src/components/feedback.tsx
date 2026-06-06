"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Button, Card } from "./ui";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type NotifyOptions = {
  title?: string;
  message: string;
  variant?: "error" | "success" | "info";
};

type FeedbackContextValue = {
  /** Muestra un modal de confirmación. Resuelve true si el usuario acepta. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Muestra un modal informativo (reemplaza alert). */
  notify: (opts: NotifyOptions) => Promise<void>;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de <FeedbackProvider>");
  return ctx.confirm;
}

export function useNotify() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useNotify debe usarse dentro de <FeedbackProvider>");
  return ctx.notify;
}

type DialogState =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "notify"; opts: NotifyOptions; resolve: () => void }
  | null;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setDialog({ kind: "confirm", opts, resolve });
      }),
    [],
  );

  const notify = useCallback(
    (opts: NotifyOptions) =>
      new Promise<void>((resolve) => {
        setDialog({ kind: "notify", opts, resolve });
      }),
    [],
  );

  function cerrar(result: boolean) {
    if (!dialog) return;
    if (dialog.kind === "confirm") dialog.resolve(result);
    else dialog.resolve();
    setDialog(null);
  }

  const notifyColor =
    dialog?.kind === "notify"
      ? dialog.opts.variant === "success"
        ? "text-emerald-700 dark:text-emerald-300"
        : dialog.opts.variant === "info"
          ? "text-slate-800 dark:text-slate-100"
          : "text-red-700 dark:text-red-300"
      : "";

  return (
    <FeedbackContext.Provider value={{ confirm, notify }}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => cerrar(false)}
        >
          {/* el div interno detiene el clic para que no cierre el modal */}
          <div
            className="w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="w-full">
            {dialog.kind === "confirm" ? (
              <>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  {dialog.opts.title ?? "Confirmar"}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {dialog.opts.message}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => cerrar(false)}>
                    {dialog.opts.cancelText ?? "Cancelar"}
                  </Button>
                  <Button
                    variant={dialog.opts.danger ? "danger" : "primary"}
                    onClick={() => cerrar(true)}
                  >
                    {dialog.opts.confirmText ?? "Aceptar"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className={`text-lg font-semibold ${notifyColor}`}>
                  {dialog.opts.title ??
                    (dialog.opts.variant === "success"
                      ? "Listo"
                      : dialog.opts.variant === "info"
                        ? "Información"
                        : "Error")}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {dialog.opts.message}
                </p>
                <div className="mt-5 flex justify-end">
                  <Button onClick={() => cerrar(true)}>Entendido</Button>
                </div>
              </>
            )}
            </Card>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
