import {
  LayoutDashboard,
  TrendingDown,
  Bell,
  BarChart3,
  Database,
  LogIn,
  Gavel,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
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
  { title: "Tài sản giảm giá", url: "/discounts", icon: TrendingDown },
  { title: "Báo cáo thị trường", url: "/reports", icon: BarChart3 },
  { title: "Thông Báo & bộ lọc", url: "/alerts", icon: Bell },
];

const adminItems = [
  { title: "Quản trị dữ liệu", url: "/admin", icon: Database, end: false },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const linkBase =
    "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-sidebar-accent";
  const linkActive =
    "bg-sidebar-accent text-sidebar-primary font-medium";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gavel className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">AuctionWatch</span>
              <span className="text-[10px] text-muted-foreground">Thống kê đấu giá giảm sâu</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chính</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      href={item.url}
                      end={item.end}
                      className={linkBase}
                      activeClassName={linkActive}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Hệ thống</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink href={item.url} className={linkBase} activeClassName={linkActive}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Đăng nhập">
                  <NavLink href="/login" className={linkBase} activeClassName={linkActive}>
                    <LogIn className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Đăng nhập</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
