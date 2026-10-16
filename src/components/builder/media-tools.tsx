"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { FieldLabel } from "@puckeditor/core";
import { Crop, Upload } from "lucide-react";
import { toast } from "sonner";
import type { BlockItem } from "@/lib/builder/blocks";
import { deviceFor, deviceValues, writeDevice, type Matcher } from "@/lib/builder/class-groups";
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES } from "@/lib/builder/media";
import { usePuck } from "./editor-hooks";

/*
 * Images in the editor (lib/builder/media.ts and server/builder/media.ts have the rules):
 *   UploadsContext       whether this server takes uploads (a Blob store is connected)
 *   useUpload            sends a file to /api/builder/media and remembers it for this browser's library
 *   imageField           a Puck field: an image address, with Upload and a preview
 *   ImageCropControls    Style panel, images: crop to a shape and choose the focal point, per device
 */

export const UploadsContext = createContext(false);

const LIBRARY = "veloce.builder.uploads.v1";
const MAX_LIBRARY = 60;

/** This browser's uploads, newest first (only addresses: the files are on the server). */
export function uploadedImages(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(LIBRARY) ?? "[]") as unknown;
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string").slice(0, MAX_LIBRARY) : [];
  } catch {
    return [];
  }
}

function remember(src: string) {
  try {
    localStorage.setItem(LIBRARY, JSON.stringify([src, ...uploadedImages().filter((x) => x !== src)].slice(0, MAX_LIBRARY)));
  } catch {
    // Private mode or full storage: the image still works, it's just not listed in the library.
  }
}

export function useUpload() {
  const [busy, setBusy] = useState(false);
  const upload = async (file: File): Promise<string | null> => {
    if (!UPLOAD_TYPES.includes(file.type)) {
      toast.error("Use a JPEG, PNG, WebP, AVIF or GIF image.");
      return null;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("That image is over 5 MB. Try a smaller one.");
      return null;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/builder/media", { method: "POST", body });
      const out = (await res.json().catch(() => ({}))) as { src?: string; error?: string };
      if (!res.ok || !out.src) {
        toast.error(out.error ?? "The upload didn't go through. Please try again.");
        return null;
      }
      remember(out.src);
      return out.src;
    } catch {
      toast.error("The upload didn't go through. Check your connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { upload, busy };
}

/** A button that picks an image and uploads it; `onUploaded` gets its address. Hidden when uploads are off. */
export function UploadButton({ onUploaded, disabled, children }: { onUploaded: (src: string) => void; disabled?: boolean; children?: ReactNode }) {
  const enabled = useContext(UploadsContext);
  const input = useRef<HTMLInputElement>(null);
  const { upload, busy } = useUpload();
  if (!enabled) return null;
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={UPLOAD_TYPES.join(",")}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const src = await upload(file);
          if (src) onUploaded(src);
        }}
      />
      <button type="button" disabled={disabled || busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs disabled:opacity-50">
        <Upload size={14} aria-hidden /> {busy ? "Uploading…" : (children ?? "Upload")}
      </button>
    </>
  );
}

/** An image address with Upload and a small preview: the field for every image (pieces, blocks, items). */
export function ImageAddress({ value, onChange, readOnly, id, label = "Image address" }: { value: string | undefined; onChange: (v: string) => void; readOnly?: boolean; id?: string; label?: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- a preview of whatever address was given
          <img src={value} alt="" className="size-10 shrink-0 rounded border object-cover" />
        ) : null}
        <input id={id} aria-label={label} disabled={readOnly} value={value ?? ""} placeholder="https://…" onChange={(e) => onChange(e.target.value.trim())} className="min-h-9 min-w-0 flex-1 rounded border px-2" />
      </div>
      <UploadButton disabled={readOnly} onUploaded={onChange}>Upload an image</UploadButton>
    </div>
  );
}

/** Puck field definition for an image prop. Custom fields draw their own label. */
export const imageField = (label: string) => ({
  type: "custom" as const,
  label,
  render: ({ value, onChange, readOnly, id }: { value: string; onChange: (v: string) => void; readOnly?: boolean; id: string }) => (
    <FieldLabel label={label} el="div" readOnly={readOnly}>
      <ImageAddress value={value} onChange={onChange} readOnly={readOnly} id={id} label={label} />
    </FieldLabel>
  ),
});

/* ------------------------------------------------------------------------------------------------------------------
 * Crop and focal point: classes, per device like the rest of the Style panel.
 * ---------------------------------------------------------------------------------------------------------------- */

const ASPECT: Matcher = /^aspect-/;
const FIT: Matcher = /^object-(cover|contain|fill|none|scale-down)$/;
const FOCUS: Matcher = /^object-(\[\d{1,3}%_\d{1,3}%\]|center|top|bottom|left|right|left-top|left-bottom|right-top|right-bottom)$/;

const SHAPES = [
  { value: "", label: "As the design has it" },
  { value: "aspect-square", label: "Square" },
  { value: "aspect-[4/3]", label: "Landscape 4:3" },
  { value: "aspect-video", label: "Wide 16:9" },
  { value: "aspect-[21/9]", label: "Banner 21:9" },
  { value: "aspect-[3/4]", label: "Portrait 3:4" },
];

/** Where the focal point is, in percent from the top left (centre when not set). */
function focusOf(v: string | undefined): { x: number; y: number } {
  const m = v?.match(/^object-\[(\d+)%_(\d+)%\]$/);
  if (m) return { x: Number(m[1]), y: Number(m[2]) };
  const named: Record<string, [number, number]> = { top: [50, 0], bottom: [50, 100], left: [0, 50], right: [100, 50], "left-top": [0, 0], "left-bottom": [0, 100], "right-top": [100, 0], "right-bottom": [100, 100] };
  const [x, y] = named[v?.slice(7) ?? ""] ?? [50, 50];
  return { x, y };
}

export function ImageCropControls() {
  const selected = usePuck((s) => s.selectedItem) as BlockItem | null;
  const getSelectorForId = usePuck((s) => s.getSelectorForId);
  const dispatch = usePuck((s) => s.dispatch);
  const width = usePuck((s) => s.appState.ui.viewports.current.width);
  if (!selected || selected.type !== "DImage" || selected.props.listCopy) return null;
  const device = deviceFor(width);
  const className = String(selected.props.className ?? "");
  const shape = deviceValues(className, ASPECT)[device];
  const focus = focusOf(deviceValues(className, FOCUS)[device]);
  const src = String(selected.props.src ?? "");
  const write = (next: string) => {
    const where = getSelectorForId(String(selected.props.id));
    if (where) dispatch({ type: "replace", destinationIndex: where.index, destinationZone: where.zone, data: { ...selected, props: { ...selected.props, className: next } } as never });
  };

  return (
    <details className="rounded bg-black/[0.03] p-2 text-sm" open={!!shape}>
      <summary className="flex cursor-pointer items-center gap-1.5 font-semibold">
        <Crop size={14} aria-hidden /> Crop and focal point
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs">
          Shape ({device})
          <select
            value={shape ?? ""}
            onChange={(e) => {
              let next = writeDevice(className, ASPECT, device, e.target.value || undefined);
              // A set shape fills it, cropping the edges; the focal point says which part stays in view.
              if (e.target.value && !deviceValues(next, FIT)[device]) next = writeDevice(next, FIT, device, "object-cover");
              write(next);
            }}
            className="min-h-9 rounded border px-2"
          >
            {SHAPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        {src ? (
          <div className="flex flex-col gap-1 text-xs">
            <span id="focal-label">Focal point: click the part that must stay in view</span>
            <button
              type="button"
              aria-labelledby="focal-label"
              className="relative overflow-hidden rounded border"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
                const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)));
                write(writeDevice(className, FOCUS, device, x === 50 && y === 50 ? undefined : `object-[${x}%_${y}%]`));
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the selected image itself */}
              <img src={src} alt="" className="block max-h-48 w-full object-contain" />
              <span aria-hidden className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.6)]" style={{ left: `${focus.x}%`, top: `${focus.y}%` }} />
            </button>
            <span className="opacity-70">{focus.x}% across, {focus.y}% down{focus.x === 50 && focus.y === 50 ? " (centre)" : ""}</span>
          </div>
        ) : null}
      </div>
    </details>
  );
}
