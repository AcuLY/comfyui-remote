import type { AnchorHTMLAttributes, ReactNode } from "react";

type HardNavigationLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children?: ReactNode;
};

export function HardNavigationLink({
  href,
  children,
  ...props
}: HardNavigationLinkProps) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
