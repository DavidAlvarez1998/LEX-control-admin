"use client";

// Uploader ESTÁNDAR de N documentos para el portal admin (modo "en vivo": subida
// inmediata a una entidad existente). Espejo del componente del portal cliente,
// con las primitivas/tokens del admin. Pasa `subir` (sube al instante cada archivo)
// + `existentes` (ya subidos) + `quitar`. `extra` se pinta sobre la zona de carga
// (p. ej. el selector de categoría del contrato).

import { useState, type ReactNode } from "react";
import { Button, Modal } from "./ui";

export type DocSubido = { id: string; nombre: string; url?: string | null; sub?: string };

export function DocumentosUploader({
  titulo = "Documentos",
  descripcion,
  opcional = true,
  readOnly = false,
  extra,
  existentes = [],
  subir,
  quitar,
}: {
  titulo?: string;
  descripcion?: string;
  opcional?: boolean;
  readOnly?: boolean;
  extra?: ReactNode;
  existentes?: DocSubido[];
  subir: (file: File) => Promise<void>;
  quitar: (id: string) => Promise<void>;
}) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<DocSubido | null>(null);

  async function subirVivo(files: FileList | File[]) {
    const arr = Array.from(files);
    if (!arr.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of arr) await subir(file);
    } catch {
      setError("No se pudo subir el documento. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  async function quitarVivo(doc: DocSubido) {
    setBusy(true);
    setError(null);
    try {
      await quitar(doc.id);
      setABorrar(null);
    } catch {
      setError("No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-subtle p-3">
      <p className="text-sm font-medium text-foreground">
        {titulo}
        {opcional && <span className="ml-1 font-normal text-muted">(opcional)</span>}
      </p>
      {descripcion && <p className="mb-3 mt-0.5 text-xs text-muted">{descripcion}</p>}

      {existentes.length > 0 && (
        <ul className="mb-3 mt-3 space-y-2">
          {existentes.map((d) => (
            <li key={d.id} className="rounded-lg border border-line bg-surface px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{d.nombre}</p>
                  {d.sub && <p className="text-xs text-muted">{d.sub}</p>}
                </div>
                <span className="flex shrink-0 items-center gap-3 text-xs">
                  {d.url && (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                      Ver
                    </a>
                  )}
                  {!readOnly && (
                    <button type="button" onClick={() => setABorrar(d)} className="font-medium text-red-600 hover:underline">
                      Quitar
                    </button>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <>
          {extra && <div className="mb-3">{extra}</div>}
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (e.dataTransfer.files?.length) subirVivo(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed px-3 py-4 text-center transition-colors ${
              busy ? "pointer-events-none opacity-60" : ""
            } ${drag ? "border-accent bg-accent/5" : "border-line bg-surface hover:border-accent"}`}
          >
            <span className="text-sm font-medium text-foreground">
              {busy ? "Subiendo…" : (
                <>
                  Arrastra archivos aquí o <span className="text-accent">elígelos</span>
                </>
              )}
            </span>
            <span className="text-xs text-muted">Puedes agregar varios</span>
            <input
              type="file"
              multiple
              disabled={busy}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) subirVivo(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <Modal
        open={!!aBorrar}
        onClose={() => !busy && setABorrar(null)}
        title="Quitar documento"
        footer={
          <>
            <Button variant="ghost" onClick={() => setABorrar(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => aBorrar && quitarVivo(aBorrar)} disabled={busy}>
              {busy ? "Quitando…" : "Quitar"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          ¿Quitar &quot;{aBorrar?.nombre}&quot;? Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  );
}
