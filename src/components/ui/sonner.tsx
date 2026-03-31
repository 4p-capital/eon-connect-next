"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "#dcfce7",
          "--success-text": "#166534",
          "--success-border": "#86efac",
          "--error-bg": "#fee2e2",
          "--error-text": "#991b1b",
          "--error-border": "#fca5a5",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
