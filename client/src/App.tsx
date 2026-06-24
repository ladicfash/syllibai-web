import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Library from "./pages/Library";
import SourceHub from "./pages/SourceHub";
import StudyTools from "./pages/StudyTools";
import StudyStudio from "./pages/StudyStudio";
import Timer from "./pages/Timer";
import Planner from "./pages/Planner";
import SpacedRep from "./pages/SpacedRep";
import Notes from "./pages/Notes";
import Simulations from "./pages/Simulations";
import VoiceNotes from "./pages/VoiceNotes";
import VideoNotes from "./pages/VideoNotes";
import Explore from "./pages/Explore";
import Profile from "./pages/Profile";
import CollabSpace from "./pages/CollabSpace";
import Settings from "./pages/Settings";
import StudyLayout from "./components/StudyLayout";
import LogoIntro from "./components/LogoIntro";
import TermsModal from "./components/TermsModal";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "./lib/trpc";
import { useEffect, useRef, useState, useCallback } from "react";

// Load Mermaid.js from CDN
function MermaidLoader() {
  useEffect(() => {
    if (typeof window !== "undefined" && !(window as any).mermaid) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);
  return null;
}

const SESSION_KEY = "syllabai_intro_shown";

// Applies the user's saved accent color as a CSS variable on the document root
function AccentColorApplier() {
  const { isAuthenticated } = useAuth();
  const { data: settings } = trpc.settings.get.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => {
    const accent = (settings as any)?.accentColor;
    if (accent) {
      // Directly set the primary color CSS variables to the user's chosen accent
      document.documentElement.style.setProperty("--color-primary", accent);
      document.documentElement.style.setProperty("--color-ring", accent);
    } else {
      // Reset to defaults by removing the inline styles
      document.documentElement.style.removeProperty("--color-primary");
      document.documentElement.style.removeProperty("--color-ring");
    }
  }, [(settings as any)?.accentColor]);
  return null;
}

function AppRoutes() {
  const { isAuthenticated, loading, user } = useAuth();
  const [showIntro, setShowIntro] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const prevAuth = useRef<boolean | null>(null);
  const utils = trpc.useUtils();

  // Show the intro animation exactly once per browser session, when the user
  // transitions from unauthenticated → authenticated (i.e. just logged in).
  useEffect(() => {
    if (loading) return;
    const justLoggedIn = prevAuth.current === false && isAuthenticated;
    const neverShown = !sessionStorage.getItem(SESSION_KEY);
    if (isAuthenticated && (justLoggedIn || neverShown)) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setShowIntro(true);
    }
    prevAuth.current = isAuthenticated;
  }, [isAuthenticated, loading]);

  // Show terms if user is authenticated but hasn't accepted yet
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      const hasAccepted = !!(user as any).acceptedTermsAt;
      if (!hasAccepted && !termsAccepted) {
        setShowTerms(true);
      }
    }
  }, [isAuthenticated, loading, user, termsAccepted]);

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false);
  }, []);

  const handleTermsAccepted = useCallback(() => {
    setShowTerms(false);
    setTermsAccepted(true);
    utils.auth.me.invalidate();
  }, [utils]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.09 0.03 258)" }}>
        <div className="flex flex-col items-center gap-4">
          <img
            src="/manus-storage/syllibai-icon_7a0c12a1.jpeg"
            alt="syllabAI"
            className="w-12 h-12 rounded-2xl object-cover animate-pulse"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {showIntro && <LogoIntro onComplete={handleIntroComplete} />}
      <TermsModal open={showTerms} onAccepted={handleTermsAccepted} />

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
        <Route path="/source-hub">
          {isAuthenticated ? <StudyLayout><SourceHub /></StudyLayout> : <Landing />}
        </Route>
        <Route path="/study-tools">
          {isAuthenticated ? <StudyLayout><StudyTools /></StudyLayout> : <Landing />}
        </Route>
        <Route path="/study-studio">
          {isAuthenticated ? <StudyLayout><StudyStudio /></StudyLayout> : <Landing />}
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
        <Route path="/video-notes">
          {isAuthenticated ? <StudyLayout><VideoNotes /></StudyLayout> : <Landing />}
        </Route>

        {/* Collab Space — public but gated */}
        <Route path="/collab">
          {isAuthenticated
            ? <StudyLayout><CollabSpace /></StudyLayout>
            : <CollabSpace />}
        </Route>

        {/* Public profile */}
        <Route path="/profile/:userId">
          {isAuthenticated
            ? <StudyLayout><Profile /></StudyLayout>
            : <Profile />}
        </Route>
        <Route path="/profile">
          {isAuthenticated
            ? <StudyLayout><Profile /></StudyLayout>
            : <Landing />}
        </Route>

        {/* Explore — public but gated */}
        <Route path="/explore">
          {isAuthenticated
            ? <StudyLayout><Explore /></StudyLayout>
            : <Explore />}
        </Route>
        <Route path="/explore/:rest*">
          {isAuthenticated
            ? <StudyLayout><Explore /></StudyLayout>
            : <Explore />}
        </Route>

        {/* Settings — protected */}
        <Route path="/settings">
          {isAuthenticated ? <StudyLayout><Settings /></StudyLayout> : <Landing />}
        </Route>

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <MermaidLoader />
          <AccentColorApplier />
          <Toaster richColors position="top-right" />
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
