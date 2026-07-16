import { createFileRoute, Outlet, Link, redirect, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { User, Settings, Bell, Share2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/settings" || location.pathname === "/settings/") {
      throw redirect({ to: "/settings/profile" });
    }
  },
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your account preferences, user profile, and integrations.</p>
      </div>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 border-b md:border-b-0 border-border">
            <Link
              to="/settings/profile"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
              activeProps={{ className: "!bg-secondary !text-foreground font-semibold" }}
            >
              <User className="size-4" />
              <span>Profile</span>
            </Link>
            <Link
              to="/settings/preferences"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
              activeProps={{ className: "!bg-secondary !text-foreground font-semibold" }}
            >
              <Settings className="size-4" />
              <span>Preferences</span>
            </Link>
            <Link
              to="/settings/notifications"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
              activeProps={{ className: "!bg-secondary !text-foreground font-semibold" }}
            >
              <Bell className="size-4" />
              <span>Notifications</span>
            </Link>
            <Link
              to="/settings/integrations"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
              activeProps={{ className: "!bg-secondary !text-foreground font-semibold" }}
            >
              <Share2 className="size-4" />
              <span>Integrations</span>
            </Link>
          </nav>
        </aside>

        {/* Dynamic Content Panel */}
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <Outlet />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
