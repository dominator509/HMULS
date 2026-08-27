import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Kicker({
  children,
  accent,
  className,
}: {
  children: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return <p className={cn("kicker", accent && "kicker-accent", className)}>{children}</p>;
}

export function PageHeader({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <header className="max-w-2xl">
      <Kicker>{kicker}</Kicker>
      <h1 className="mt-2 font-display text-4xl leading-tight text-fg sm:text-5xl">{title}</h1>
      {body ? <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">{body}</p> : null}
      {children}
    </header>
  );
}

export function Panel({
  children,
  className,
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return <div className={cn("panel", pad && "panel-pad", className)}>{children}</div>;
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("progress-track", className)} role="progressbar" aria-valuenow={pct}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Overlay({
  children,
  onClose,
  wide,
  labelledBy,
}: {
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  labelledBy?: string;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const node = (
    <div
      className="overlay-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={onClose}
    >
      <div
        className={cn("overlay-panel", wide && "overlay-panel-wide")}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

export function OverlayClose(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label="Close"
      className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full bg-bg/70 text-fg hover:bg-bg"
      {...props}
    >
      <X className="size-4" />
    </button>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function inputClass(extra?: string) {
  return cn("field-input", extra);
}

export function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          data-active={value === o.id}
          className="seg-btn"
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MediaFrame({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-raised", className)} style={style}>
      {children}
    </div>
  );
}
