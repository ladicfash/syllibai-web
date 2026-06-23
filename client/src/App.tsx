import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Library from "./pages/Library";
import StudyTools from "./pages/StudyTools";
import Timer from "./pages/Timer";
import Planner from "./pages/Planner";
import SpacedRep from "./pages/SpacedRep";
import Notes from "./pages/Notes";
import Simulations from "./pages/Simulations";
import VoiceNotes from "./pages/VoiceNotes";
import StudyLayout from "./components/StudyLayout";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect } from "react";

// Load Mermaid.js from CDN
function MermaidLoader() {
  useEffect(() => {
    if (typeof window !== "undefined" && !window.mermaid) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);
  return null;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading SyllibAI...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public landing */}
      <Route path="/" component={Landing} />

      {/* Protected app routes inside StudyLayout */}
      <Route path="/dashboard">
        {isAuthenticated ? <StudyLayout><Dashboard /></StudyLayout> : <Landing />}
      </Route>
      <Route path="/library">
        {isAuthenticated ? <StudyLayout><Library /></StudyLayout> : <Landing />}
      </Route>
      <Route path="/study-tools">
        {isAuthenticated ? <StudyLayout><StudyTools /></StudyLayout> : <Landing />}
      </Route>
      <Route path="/timer">
        {isAuthenticated ? <StudyLayout><Timer /></StudyLayout> : <Landing />}
      </Route>
      <Route path="/planner">
        {isAuthenticated ? <StudyLayout><Planner /></StudyLayout> : <Landing />}
      </Route>
      <Route path="/spaced-rep">
        {isAuthenticated ? <StudyLayout><SpacedRep /></StudyLayout> : <Landing />}
      </Route>
      <Route path="/spaced-repetition">
        {isAuthenticated ? <StudyLayout><SpacedRep /></StudyLayout> : <Landing />}
      </Route>
      <Route path="/notes">
        {isAuthenticated ? <StudyLayout><Notes /></StudyLayout> : <Landing />}
      </Route>
      <Route path="/simulations">
        {isAuthenticated ? <StudyLayout><Simulations /></StudyLayout> : <Landing />}
      </Route>
      <Route path="/voice">
        {isAuthenticated ? <StudyLayout><VoiceNotes /></StudyLayout> : <Landing />}
      </Route>
      <Route path="/voice-notes">
        {isAuthenticated ? <StudyLayout><VoiceNotes /></StudyLayout> : <Landing />}
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <MermaidLoader />
          <Toaster richColors position="top-right" />
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
