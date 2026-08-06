"use client";

import { useState, type MouseEvent } from "react";

type ShareButtonProps = {
  title: string;
  text?: string;
  url: string;
  className?: string;
};

/**
 * Botón de compartir real — usa la Web Share API nativa (abre el share
 * sheet del sistema operativo) cuando está disponible, y cae a copiar el
 * link al portapapeles si no (ej. desktop/navegadores sin soporte). No es
 * un ícono decorativo.
 */
export function ShareButton({ title, text, url, className = "" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // usuario canceló el share sheet — no hacer nada
        return;
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // portapapeles bloqueado por permisos — falla silenciosa, no crítico
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Share"
      title={copied ? "Link copied" : "Share"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink shadow-sm transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      {copied ? (
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
          <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
          <circle cx="15" cy="5" r="2.25" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="5" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="15" cy="15" r="2.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 8.8l6-2.6M7 11.2l6 2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
