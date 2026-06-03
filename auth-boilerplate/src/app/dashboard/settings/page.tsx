"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { authClient } from "@/lib/auth-client";
import * as FancyButton from "@/components/ui/fancy-button";
import { LogoMark } from "@/components/shared/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Tab = "profile" | "api-keys";

interface ApiKey {
  id: string;
  name: string | null;
  start: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  enabled: boolean;
  lastRequest: Date | null;
}

export default function SettingsPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);

  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (tab === "api-keys" && session) {
      loadKeys();
    }
  }, [tab, session]);

  async function loadKeys() {
    setLoadingKeys(true);
    try {
      const { data, error } = await (authClient.apiKey as any).list();
      if (error) throw new Error(error.message || "Error loading keys");
      setKeys((data as any)?.apiKeys || data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingKeys(false);
    }
  }

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError(null);
    setCreatedKey(null);
    try {
      const { data, error } = await (authClient.apiKey as any).create({
        name: newKeyName.trim(),
        expiresIn: null,
      });
      if (error) throw new Error(error.message || "Error creating key");
      setCreatedKey((data as any)?.key || (data as any)?.token || "");
      setNewKeyName("");
      loadKeys();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    try {
      const { error } = await (authClient.apiKey as any).delete({ keyId });
      if (error) throw new Error(error.message || "Error revoking key");
      setKeys(keys.filter((k) => k.id !== keyId));
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <main className="min-h-dvh bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <LogoMark className="h-10 w-10" />
          <FancyButton.Root variant="secondary" size="small" onClick={() => signOut()}>
            Sign Out
          </FancyButton.Root>
        </div>

        <nav className="flex gap-2 border-b pb-2">
          <button
            onClick={() => setTab("profile")}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              tab === "profile" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setTab("api-keys")}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              tab === "api-keys" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            API Keys
          </button>
        </nav>

        {tab === "profile" && (
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{session.user?.email}</span>
              </div>
              {session.user?.name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{session.user?.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email Verified</span>
                <span className="font-medium">{session.user?.emailVerified ? "Yes" : "No"}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "api-keys" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Create API keys to authenticate from the Fastify API or MCP clients
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Key name (e.g. Claude Desktop)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                  <FancyButton.Root
                    variant="primary"
                    size="small"
                    onClick={handleCreate}
                    disabled={creating || !newKeyName.trim()}
                  >
                    {creating ? "Creating..." : "Create Key"}
                  </FancyButton.Root>
                </div>

                {createdKey && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
                    <p className="font-medium text-green-800 mb-1">Key created — copy it now, it won't be shown again:</p>
                    <code className="block bg-green-100 px-2 py-1 rounded text-xs break-all select-all">
                      {createdKey}
                    </code>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your Keys</CardTitle>
                <CardDescription>
                  {loadingKeys ? "Loading..." : `${keys.length} key(s) active`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {keys.length === 0 && !loadingKeys && (
                  <p className="text-sm text-muted-foreground">No API keys yet. Create one above.</p>
                )}
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{key.name || "Unnamed key"}</p>
                      <p className="text-xs text-muted-foreground">
                        {key.start ? `${key.start}...` : "..."}
                        {key.expiresAt && ` — Expires ${new Date(key.expiresAt).toLocaleDateString()}`}
                        {key.lastRequest
                          ? ` — Last used ${new Date(key.lastRequest).toLocaleDateString()}`
                          : " — Never used"}
                      </p>
                    </div>
                    <FancyButton.Root
                      variant="destructive"
                      size="xsmall"
                      onClick={() => handleRevoke(key.id)}
                    >
                      Revoke
                    </FancyButton.Root>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
