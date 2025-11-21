import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type PaperBackgroundProps = {
  children: ReactNode;
  className?: string;
};

export function PaperBackground({ children, className }: PaperBackgroundProps) {
  return (
    <div
      className={cn(
        "paper-gradient paper-noise stone-theme relative isolate min-h-screen bg-[var(--background)] text-[var(--foreground)] overflow-hidden",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.65), transparent 60%), radial-gradient(circle at 80% 0%, rgba(255, 255, 255, 0.4), transparent 45%), radial-gradient(circle at 20% 80%, rgba(218, 209, 193, 0.4), transparent 55%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

