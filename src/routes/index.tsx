import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PublicLeaderboard } from "@/components/public-leaderboard";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: RootPage });

function RootPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return null;
  if (!user) return <PublicLeaderboard />;
  return <Navigate to="/$" params={{ _splat: "home" }} replace />;
}
