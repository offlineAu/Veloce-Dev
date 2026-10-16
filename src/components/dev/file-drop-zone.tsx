"use client";

import { useId, useRef, useState } from "react";
import { Check, FileCode2, FileImage, FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./dev-upload.module.css";

export const fileSize = (bytes: number) => bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : bytes >= 1_000 ? `${Math.ceil(bytes / 1_000)} KB` : `${bytes} bytes`;

function accepts(file: File, accept: string) {
  return accept.split(",").some(value => {
    const token = value.trim().toLowerCase();
    return token.startsWith(".") ? file.name.toLowerCase().endsWith(token)
      : token.endsWith("/*") ? file.type.toLowerCase().startsWith(token.slice(0, -1))
      : file.type.toLowerCase() === token;
  });
}

/** Native file input keeps its keyboard and picker behaviour; drag/drop uses the same selection path. */
export function FileDropZone({
  label, kind, accept, title, hint, buttonText, files, multiple = false, compact = false, disabled = false,
  maxSize, directory = false, onFiles, onRemove,
}: {
  label: string; kind: "html" | "markdown" | "image"; accept: string; title: string; hint: string; buttonText: string;
  files: File[]; multiple?: boolean; compact?: boolean; disabled?: boolean; maxSize?: number; directory?: boolean;
  onFiles: (files: File[]) => void; onRemove?: () => void;
}) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const dragDepth = useRef(0);
  const Icon = kind === "html" ? FileCode2 : kind === "markdown" ? FileText : FileImage;
  const selected = files.length > 0;
  const pick = (incoming: File[]) => {
    if (disabled || !incoming.length) return;
    if (directory) incoming = incoming.filter(file => accepts(file, accept));
    if (!incoming.length) return setError("No supported images found in that folder.");
    if (!multiple && incoming.length > 1) return setError("Choose one file at a time.");
    if (incoming.some(file => !accepts(file, accept))) {
      return setError(kind === "html" ? "Choose .html or .htm files." : kind === "markdown" ? "Choose a Markdown (.md) file." : "Choose a supported image file.");
    }
    if (maxSize && incoming.some(file => file.size > maxSize)) return setError(`Each file must be ${fileSize(maxSize)} or smaller.`);
    setError(undefined);
    onFiles(incoming);
  };
  return <div className={cn(styles.dropField, compact && styles.compact)}>
    <label
      className={cn(styles.dropZone, selected && styles.hasFiles, dragging && styles.dragging, disabled && styles.disabled)}
      onDragEnter={event => { event.preventDefault(); if (!disabled && event.dataTransfer.types.includes("Files")) { dragDepth.current++; setDragging(true); } }}
      onDragLeave={event => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? "none" : "copy"; }}
      onDrop={event => { event.preventDefault(); dragDepth.current = 0; setDragging(false); pick(Array.from(event.dataTransfer.files)); }}
    >
      <input id={id} type="file" accept={accept} multiple={multiple} {...(directory ? { webkitdirectory: "" } : {})} disabled={disabled} aria-label={label} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} aria-invalid={!!error} className={styles.nativeInput}
        onChange={event => { pick(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      <span className={styles.fileIcon}><Icon size={compact ? 19 : 25} strokeWidth={1.5} aria-hidden="true" />{selected ? <span className={styles.check}><Check size={9} strokeWidth={3} aria-hidden="true" /></span> : null}</span>
      <span className={styles.dropCopy}>
        <span className={styles.dropTitle}>{dragging ? "Drop to add files" : selected && !multiple ? files[0]!.name : title}</span>
        <span id={`${id}-hint`} className={styles.dropHint}>{selected && !multiple ? `${fileSize(files[0]!.size)} · Click or drop to replace` : hint}</span>
      </span>
      <span className={styles.browse}><Upload size={13} aria-hidden="true" />{selected && !multiple ? "Replace" : buttonText}</span>
    </label>
    {selected && !multiple && onRemove ? <button type="button" className={styles.removeFile} disabled={disabled} aria-label={`Remove ${files[0]!.name}`} onClick={() => { setError(undefined); onRemove(); }}><X size={13} aria-hidden="true" />Remove file</button> : null}
    {error ? <p role="alert" id={`${id}-error`} className={styles.fileError}>{error}</p> : null}
  </div>;
}
