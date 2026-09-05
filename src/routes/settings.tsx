import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/pulsewatch/MarketBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getProfile, updateProfile } from "@/lib/marketpulse.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — PulseWatch" },
      { name: "description", content: "Manage your PulseWatch profile and session." },
    ],
  }),
  component: SettingsPage,
});

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.charAt(0).toUpperCase();
  const last = parts[parts.length - 1];
  if (!last) return first.charAt(0).toUpperCase();
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, loading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const profileFn = useServerFn(getProfile);
  const updateFn = useServerFn(updateProfile);

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/auth" });
  }, [authLoading, session, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileFn(),
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (data?.display_name) setDisplayName(data.display_name);
  }, [data?.display_name]);

  const updateMutation = useMutation({
    mutationFn: () => updateFn({ data: { displayName } }),
    onSuccess: () => {
      setMessage("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: unknown) =>
      setMessage(err instanceof Error ? err.message : "Could not save profile"),
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (authLoading || isLoading || !data) {
    return (
      <AppShell>
        <Skeleton className="h-72 w-full rounded-xl" />
      </AppShell>
    );
  }

  const initials = getInitials(displayName || data.email || "User");
  const email = data.email ?? session?.user.email ?? "";

  return (
    <AppShell>
      <div className="max-w-xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your PulseWatch profile.</p>
        </div>

        <section className="rounded-2xl border border-border bg-surface p-6">
          {/* Profile Header */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="text-2xl font-semibold">{initials}</span>
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">{displayName || "User"}</h2>
              <p className="text-sm text-muted-foreground">{email}</p>
              <span className="mt-1 inline-flex items-center rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-primary">
                PulseWatch member
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled />
            </div>
            {message && (
              <p
                className={cn(
                  "text-sm",
                  message === "Profile saved" ? "text-positive" : "text-negative",
                )}
              >
                {message}
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="flex-1 sm:flex-none"
              >
                {updateMutation.isPending ? "Saving..." : "Save profile"}
              </Button>
              <Button variant="outline" onClick={signOut} className="flex-1 sm:flex-none">
                Sign out
              </Button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
