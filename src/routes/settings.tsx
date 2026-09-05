import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/pulsewatch/MarketBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
    onError: (err: unknown) => setMessage(err instanceof Error ? err.message : "Could not save profile"),
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (authLoading || isLoading || !data) {
    return (
      <AppShell>
        <Skeleton className="h-72 w-full rounded-xl" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-xl space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Profile and session preferences.</p>
        </div>

        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={data.email ?? session?.user.email ?? ""} disabled />
            </div>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save profile"}
              </Button>
              <Button variant="secondary" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
