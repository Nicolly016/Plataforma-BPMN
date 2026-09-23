"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function Dropdown({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button size="sm" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>
        {label}
      </Button>
      {open ? (
        <div role="menu" className="absolute right-0 z-30 mt-1 min-w-44 border border-zinc-200 bg-white py-1 shadow-lg" onClick={() => setOpen(false)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({ children }: { children: React.ReactNode }) {
  return <div className="[&_a]:block [&_a]:px-3 [&_a]:py-2 [&_a]:text-sm [&_a]:text-zinc-800 [&_a:hover]:bg-zinc-50 [&_button]:w-full [&_button]:px-3 [&_button]:py-2 [&_button]:text-left [&_button]:text-sm [&_button]:text-zinc-800 [&_button:hover]:bg-zinc-50">{children}</div>;
}
