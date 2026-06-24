import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard, BookOpen, Brain, Clock, Calendar,
  Mic, ChevronLeft, ChevronRight, Sun, Moon,
  LogOut, Menu, X, StickyNote, Zap, FlaskConical,
  Compass, Timer, ListTodo, Users, Settings, Video, Database, Wand2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

const navSections = [
  {
    label: "Overview",
    items: [
      { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { path: "/explore",   icon: Compass,         label: "Explore"   },
      { path: "/collab",    icon: Users,           label: "Collab Space" },
    ],
  },
  {
    label: "Study",
    items: [
      { path: "/library",     icon: BookOpen,    label: "Library"          },
      { path: "/source-hub",  icon: Database,    label: "Source Hub"       },
      { path: "/study-tools", icon: Wand2,       label: "Study Studio"     },
      { path: "/spaced-rep",  icon: Zap,         label: "Spaced Repetition"},
      { path: "/voice",       icon: Mic,         label: "Voice Notes"      },
      { path: "/video-notes", icon: Video,        label: "Video Notes"      },
      { path: "/simulations", icon: FlaskConical,label: "Simulations"      },
    ],
  },
  {
    label: "Organise",
    items: [
      { path: "/notes",   icon: StickyNote, label: "Notes"       },
      { path: "/planner", icon: ListTodo,   label: "Planner"     },
      { path: "/timer",   icon: Timer,      label: "Study Timer" },
    ],
  },
  {
    label: "Account",
    items: [
      { path: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

const LOGO_ICON = "/manus-storage/syllibai-icon_7a0c12a1.jpeg";

interface StudyLayoutProps {
  children: React.ReactNode;
}

export default function StudyLayout({ children }: StudyLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { data: dueCards } = trpc.decks.dueCards.useQuery(undefined, { enabled: !!user, staleTime: 60_000 });

  useEffect(() => setMobileOpen(false), [location]);

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "S";

  const isActive = (path: string) =>
    location === path || (path !== "/dashboard" && location.startsWith(path));

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-white/8 flex-shrink-0 gap-3",
        collapsed && "justify-center px-2"
      )}>
        <img src={LOGO_ICON} alt="syllabAI" className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
        {!collapsed && (
          <span className="font-display font-bold text-[15px] text-white tracking-tight">syllabAI</span>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/25 select-none">
                {section.label}
              </p>
            )}
            {collapsed && <div className="my-1 mx-auto w-6 h-px bg-white/10" />}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <Tooltip key={item.path} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link href={item.path}>
                        <div className={cn(
                          "flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer select-none",
                          "text-white/55 hover:text-white hover:bg-white/8",
                          active && "bg-white/12 text-white",
                          collapsed && "justify-center px-2"
                        )}>
                          <item.icon className={cn(
                            "w-[17px] h-[17px] flex-shrink-0 transition-colors",
                            active ? "text-primary" : "text-white/55"
                          )} />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {!collapsed && item.path === "/spaced-rep" && (dueCards?.length ?? 0) > 0 && (
                            <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground flex-shrink-0">{dueCards?.length}</span>
                          )}
                          {!collapsed && active && item.path !== "/spaced-rep" && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </div>
                      </Link>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right" className="text-xs font-medium">
                        {item.label}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: theme + user */}
      <div className="flex-shrink-0 border-t border-white/8 p-2 space-y-0.5">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={toggleTheme}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-[7px] rounded-lg text-[13px] font-medium",
                "text-white/45 hover:text-white hover:bg-white/8 transition-all",
                collapsed && "justify-center px-2"
              )}
            >
              {theme === "dark"
                ? <Sun className="w-[17px] h-[17px] flex-shrink-0" />
                : <Moon className="w-[17px] h-[17px] flex-shrink-0" />}
              {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="text-xs">
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </TooltipContent>
          )}
        </Tooltip>

        <div className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-lg",
          collapsed && "justify-center px-2"
        )}>
          <Avatar className="w-7 h-7 flex-shrink-0">
            <AvatarFallback
              className="text-[11px] font-bold"
              style={{ background: "oklch(0.42 0.18 220)", color: "white" }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white/90 truncate">{user?.name ?? "Student"}</p>
                <p className="text-[10px] text-white/35 truncate">{user?.email ?? ""}</p>
              </div>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={logout}
                    className="text-white/35 hover:text-white/80 transition-colors p-1 rounded flex-shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Sign out</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col flex-shrink-0 transition-all duration-300 ease-snappy",
          "relative z-20",
          collapsed ? "w-[60px]" : "w-[220px]"
        )}
        style={{ background: "var(--color-study-sidebar)" }}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[72px] w-6 h-6 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col lg:hidden transition-transform duration-300 ease-snappy",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "var(--color-study-sidebar)" }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center h-14 px-4 border-b border-border bg-card flex-shrink-0 gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <img src={LOGO_ICON} alt="syllabAI" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-display font-bold text-sm tracking-tight">syllabAI</span>
          </div>
          <button
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>

        {/* Page Content */}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
