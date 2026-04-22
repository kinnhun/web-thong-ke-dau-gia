import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  end?: boolean;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
}

export function NavLink({ href, end, className, activeClassName, children }: NavLinkProps) {
  const router = useRouter();
  const isActive = end ? router.pathname === href : router.pathname.startsWith(href);

  return (
    <Link href={href} className={cn(className, isActive && activeClassName)}>
      {children}
    </Link>
  );
}
