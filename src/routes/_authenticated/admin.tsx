import { useEffect } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Admin access required");
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, isAdmin, navigate]);

  if (loading || !isAdmin) {
    return (
      <AppLayout>
        <Skeleton className="h-64 rounded-2xl" />
      </AppLayout>
    );
  }

  return <Outlet />;
}
