"use client";

import * as React from "react";
import { Save, Copy, RefreshCw, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/shared/loading-state";

interface SettingsData {
  companyName?: string;
  defaultLanguage?: string;
  timezone?: string;
  mfaEnabled?: boolean;
  sessionTimeout?: string;
  passwordPolicy?: boolean;
  notifications?: {
    documentUploaded?: boolean;
    approvalRequested?: boolean;
    documentApproved?: boolean;
    documentRejected?: boolean;
    certificateGenerated?: boolean;
  };
  apiKey?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = React.useState<SettingsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [apiKeyVisible, setApiKeyVisible] = React.useState(false);

  const [companyName, setCompanyName] = React.useState("");
  const [defaultLanguage, setDefaultLanguage] = React.useState("en");
  const [timezone, setTimezone] = React.useState("utc");
  const [mfaEnabled, setMfaEnabled] = React.useState(false);
  const [sessionTimeout, setSessionTimeout] = React.useState("30");
  const [passwordPolicy, setPasswordPolicy] = React.useState(false);
  const [notifications, setNotifications] = React.useState({
    documentUploaded: false,
    approvalRequested: false,
    documentApproved: false,
    documentRejected: false,
    certificateGenerated: false,
  });

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        const s = json.settings ?? json;
        setSettings(s);
        setCompanyName(s.companyName ?? "");
        setDefaultLanguage(s.defaultLanguage ?? "en");
        setTimezone(s.timezone ?? "utc");
        setMfaEnabled(s.mfaEnabled ?? false);
        setSessionTimeout(s.sessionTimeout ?? "30");
        setPasswordPolicy(s.passwordPolicy ?? false);
        setNotifications({
          documentUploaded: s.notifications?.documentUploaded ?? false,
          approvalRequested: s.notifications?.approvalRequested ?? false,
          documentApproved: s.notifications?.documentApproved ?? false,
          documentRejected: s.notifications?.documentRejected ?? false,
          certificateGenerated: s.notifications?.certificateGenerated ?? false,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          defaultLanguage,
          timezone,
          mfaEnabled,
          sessionTimeout,
          passwordPolicy,
          notifications,
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      const json = await res.json();
      setSettings(json.settings ?? json);
    } catch {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerateApiKey() {
    if (!confirm("Regenerate API key? This will invalidate the current key.")) return;
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateApiKey: true }),
      });
      const json = await res.json();
      setSettings((prev) => prev ? { ...prev, apiKey: json.settings?.apiKey ?? json.apiKey } : prev);
    } catch {
      alert("Failed to regenerate API key");
    }
  }

  function handleCopyApiKey() {
    if (settings?.apiKey) {
      navigator.clipboard.writeText(settings.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) return <LoadingState type="loading" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage system configuration and preferences"
      />

      <form onSubmit={handleSave}>
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default-language">Default Language</Label>
                  <Select
                    id="default-language"
                    value={defaultLanguage}
                    onChange={(e) => setDefaultLanguage(e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    <option value="utc">UTC (Coordinated Universal Time)</option>
                    <option value="est">EST (Eastern Standard Time)</option>
                    <option value="pst">PST (Pacific Standard Time)</option>
                    <option value="cet">CET (Central European Time)</option>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Multi-Factor Authentication (MFA)</Label>
                    <p className="text-sm text-muted-foreground">
                      Require MFA for all admin and approver accounts
                    </p>
                  </div>
                  <Switch checked={mfaEnabled} onCheckedChange={setMfaEnabled} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Session Timeout</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically log out inactive users
                    </p>
                  </div>
                  <Select
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(e.target.value)}
                    className="w-24"
                  >
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="60">60 min</option>
                    <option value="120">2 hours</option>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Password Policy</Label>
                    <p className="text-sm text-muted-foreground">
                      Enforce strong password requirements
                    </p>
                  </div>
                  <Switch checked={passwordPolicy} onCheckedChange={setPasswordPolicy} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Email Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Document Uploaded</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify when a new document is uploaded
                    </p>
                  </div>
                  <Switch
                    checked={notifications.documentUploaded}
                    onCheckedChange={(v) => setNotifications((p) => ({ ...p, documentUploaded: v }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Approval Requested</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify when approval is requested
                    </p>
                  </div>
                  <Switch
                    checked={notifications.approvalRequested}
                    onCheckedChange={(v) => setNotifications((p) => ({ ...p, approvalRequested: v }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Document Approved</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify when a document is approved
                    </p>
                  </div>
                  <Switch
                    checked={notifications.documentApproved}
                    onCheckedChange={(v) => setNotifications((p) => ({ ...p, documentApproved: v }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Document Rejected</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify when a document is rejected
                    </p>
                  </div>
                  <Switch
                    checked={notifications.documentRejected}
                    onCheckedChange={(v) => setNotifications((p) => ({ ...p, documentRejected: v }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Certificate Generated</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify when a verification certificate is generated
                    </p>
                  </div>
                  <Switch
                    checked={notifications.certificateGenerated}
                    onCheckedChange={(v) => setNotifications((p) => ({ ...p, certificateGenerated: v }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">API Keys</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="api-key"
                        type={apiKeyVisible ? "text" : "password"}
                        value={settings?.apiKey ?? "No API key configured"}
                        readOnly
                        className="pr-9 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setApiKeyVisible(!apiKeyVisible)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {apiKeyVisible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <Button type="button" variant="outline" size="icon" title="Copy API Key" onClick={handleCopyApiKey}>
                      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button type="button" variant="outline" size="icon" title="Regenerate API Key" onClick={handleRegenerateApiKey}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This key is used for server-to-server API calls. Keep it secure.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-6">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
