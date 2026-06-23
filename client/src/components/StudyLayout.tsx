import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard, BookOpen, Brain, Clock, Calendar, FileText,
  Mic, Share2, Target, ChevronLeft, ChevronRight, Sun, Moon,
  LogOut, Menu, X, GraduationCap, StickyNote, Zap, FlaskConical,
  BarChart2, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/library", icon: BookOpen, label: "Library" },
  { path: "/study-tools", icon: Brain, label: "Study Tools" },
  { path: "/spaced-rep", icon: Zap, label: "Spaced Repetition" },
  { path: "/timer", icon: Clock, label: "Study Timer" },
  { path: "/planner", icon: Calendar, label: "Planner" },
  { path: "/notes", icon: StickyNote, label: "Notes" },
  { path: "/voice", icon: Mic, label: "Voice Notes" },
  { path: "/simulations", icon: FlaskConical, label: "Simulations" },
];

interface StudyLayoutProps {
  children: React.ReactNode;
}

export default function StudyLayout({ children }: StudyLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Close mobile menu on route change
  useEffect(() => setMobileOpen(false), [location]);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "S";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center h-16 px-4 border-b border-white/8 flex-shrink-0", collapsed && "justify-center")}>
        {collapsed ? (
          <img
            src="/manus-storage/syllibai-icon_7a0c12a1.jpeg"
            alt="syllabAI"
            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="flex items-center gap-2.5">
            <img
              src="/manus-storage/syllibai-icon_7a0c12a1.jpeg"
              alt=""
              className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
            />
            <span className="font-display font-bold text-base text-white tracking-tight">syllabAI</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location === item.path || (item.path !== "/dashboard" && location.startsWith(item.path));
          return (
            <Tooltip key={item.path} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link href={item.path}>
                  <div className={cn("sidebar-item", isActive && "active", collapsed && "justify-center px-2")}>
                    <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </div>
                </Link>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="flex-shrink-0 border-t border-white/8 p-3 space-y-1">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn("sidebar-item w-full", collapsed && "justify-center px-2")}
        >
          {theme === "dark" ? <Sun className="w-4.5 h-4.5 flex-shrink-0" /> : <Moon className="w-4.5 h-4.5 flex-shrink-0" />}
          {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>

        {/* User */}
        <div className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg", collapsed && "justify-center px-2")}>
          <Avatar className="w-7 h-7 flex-shrink-0">
            <AvatarFallback className="text-xs bg-primary/30 text-primary-foreground font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/90 truncate">{user?.name ?? "Student"}</p>
              <p className="text-xs text-white/40 truncate">{user?.email ?? ""}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={logout} className="text-white/40 hover:text-white/80 transition-colors p-1 rounded">
              <LogOut className="w-3.5 h-3.5" />
            </button>
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
          collapsed ? "w-16" : "w-60"
        )}
        style={{ background: "var(--color-study-sidebar)" }}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
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
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center h-14 px-4 border-b border-border bg-card flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground hover:text-foreground transition-colors mr-3">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <GraduationCap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">SyllibAI</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggleTheme} className="text-muted-foreground hover:text-foreground transition-colors p-1.5">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
