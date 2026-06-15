import type { ComponentType } from "react";

export type HeaderActionTone = "default" | "primary" | "pink" | "danger" | "subtle";

export type HeaderAction = {
  href?: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone?: HeaderActionTone;
};

export type HeaderSpec = {
  key: string;
  route: string;
  group: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  back?: {
    href: string;
    label: string;
  };
  actions?: HeaderAction[];
  meta?: string[];
  status?: string;
};

export type HeaderSpecSection = {
  label: string;
  specs: HeaderSpec[];
};
