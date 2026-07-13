import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { GroupForm } from "@/components/group-form";
import { useAuth } from "@/hooks/use-auth";
import { useMyGroup } from "@/hooks/use-data";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/groups/new")({
  component: NewGroupPage,
});

function NewGroupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: group, isLoading } = useMyGroup(user?.id);

  // A user may only own one group — redirect if they already have one.
  useEffect(() => {
    if (!isLoading && group) {
      navigate({ to: "/groups/$id", params: { id: group.id }, replace: true });
    }
  }, [isLoading, group, navigate]);

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create your group</h1>
        <p className="mt-1 text-muted-foreground">
          Add your team details and social profiles to get started.
        </p>
      </div>
      {isLoading || group ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        user && <GroupForm userId={user.id} />
      )}
    </AppLayout>
  );
}
