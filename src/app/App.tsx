import { AppStateProvider } from "../state/app-store";
import { useAppShortcuts } from "../hooks/useAppShortcuts";
import { AppShell } from "../ui/layout/AppShell";

function AppFrame() {
  useAppShortcuts();

  return <AppShell />;
}

export function App() {
  return (
    <AppStateProvider>
      <AppFrame />
    </AppStateProvider>
  );
}