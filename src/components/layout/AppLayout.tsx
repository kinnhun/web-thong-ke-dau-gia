import { Bell, Moon, Search, Sun, User } from "lucide-react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 sm:gap-3 border-b bg-background/80 px-3 sm:px-4 backdrop-blur">
            <SidebarTrigger className="-ml-1" />

            {/* Search — hidden on very small screens, visible from sm */}
            <div className="relative hidden sm:block flex-1 max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm tài sản, khu vực, biển số..."
                className="h-9 pl-9 bg-secondary/40 border-transparent focus-visible:bg-background"
              />
            </div>

            {/* Mobile search icon */}
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:hidden">
              <Search className="h-4 w-4" />
            </Button>

            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={toggleTheme}
                title={theme === "dark" ? "Chuyển sang sáng" : "Chuyển sang tối"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-discount-deep" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:inline-flex">
                <User className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 min-w-0 flex flex-col">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
