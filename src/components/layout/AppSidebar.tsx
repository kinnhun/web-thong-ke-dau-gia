import {
  BarChart3,
  Bell,
  ChevronRight,
  Database,
  FileText,
  Gavel,
  LayoutDashboard,
  LogIn,
  TrendingDown,
  History,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Tổng quan", url: "/", icon: LayoutDashboard, end: true },
  { title: "Thông báo đấu giá", url: "/listing", icon: FileText },
  { title: "Danh sách theo dõi", url: "/watchlist", icon: Star },
  { title: "Tài sản giảm giá", url: "/discounts", icon: TrendingDown },
  { title: "Tài sản đăng lại", url: "/relisted", icon: History },
  { title: "Báo cáo thị trường", url: "/reports", icon: BarChart3 },
  // { title: "Cảnh báo & bộ lọc", url: "/alerts", icon: Bell },
];

const adminItems = [
  { title: "Quản trị dữ liệu", url: "/admin", icon: Database },
];

function SidebarNavLink({ href, end, icon: Icon, title }: { href: string; end?: boolean; icon: typeof LayoutDashboard; title: string }) {
  const router = useRouter();
  const isActive = end ? router.pathname === href : router.pathname.startsWith(href);
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={title} isActive={isActive}>
        <Link
          href={href}
          onClick={() => isMobile && setOpenMobile(false)}
          className={cn(
            "flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-200",
            collapsed ? "justify-center px-0" : "px-3",
            isActive
              ? "bg-primary/10 text-primary shadow-sm"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <div className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            isActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-sidebar-accent/60 text-sidebar-foreground/60"
          )}>
            <Icon className="h-4 w-4" />
          </div>
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{title}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary/60" />}
            </>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <Sidebar collapsible="icon">
      {/* Logo */}
      <SidebarHeader className={cn("border-b border-sidebar-border py-4", collapsed ? "px-0 justify-center" : "px-3")}>
        <Link href="/" className={cn("flex items-center gap-3 group", collapsed && "justify-center")}>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md transition-transform group-hover:scale-105">
            <Gavel className="h-5 w-5" />
            <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-discount-deep ring-2 ring-sidebar-background" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-base font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                AuctionWatch
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wide uppercase">
                Thống kê đấu giá
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Điều hướng
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5 mt-1">
              {mainItems.map((item) => (
                <SidebarNavLink key={item.url} href={item.url} end={item.end} icon={item.icon} title={item.title} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* System */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Hệ thống
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5 mt-1">
              {adminItems.map((item) => (
                <SidebarNavLink key={item.url} href={item.url} icon={item.icon} title={item.title} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        {!collapsed ? (
          <Link
            href="/login"
            className="flex items-center gap-3 rounded-lg border border-dashed border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:border-sidebar-foreground/20"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent">
              <LogIn className="h-4 w-4 text-sidebar-foreground/60" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium">Đăng nhập</div>
              <div className="text-[10px] text-muted-foreground">Lưu bộ lọc & cảnh báo</div>
            </div>
          </Link>
        ) : (
          <SidebarMenu className="items-center">
            <SidebarNavLink href="/login" icon={LogIn} title="Đăng nhập" />
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
