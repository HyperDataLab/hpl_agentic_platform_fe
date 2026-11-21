"use client";

import { type FormEvent, useEffect, useId, useState } from "react";

import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  defaultLlmSettings,
  getLlmSettings,
  LLM_ROLES,
  type LlmRole,
  type LlmSettings,
  LlmSettingsError,
  maskKey,
  resetLlmSettings,
  saveLlmSettings,
} from "@/lib/llm/settings";

const ROLE_LABELS: Record<LlmRole, { label: string; line: string }> = {
  theorist: { label: "Theorist", line: "Drafts the hypotheses." },
  methodologist: { label: "Methodologist", line: "Says how each one could be tested." },
  skeptic: { label: "Skeptic", line: "Argues against them in the debate." },
  judge: { label: "Judge", line: "Scores the debate, picks the survivors and reviews the final set." },
};

/**
 * The language model runs use: a 9router (OpenAI-compatible) endpoint, its key, a default model and, if wanted, a
 * model per agent. Everything stays in this browser; the key goes to the worker only with a start or a resume.
 */
export function LlmSettingsForm() {
  const id = useId();
  const [settings, setSettings] = useState<LlmSettings>(defaultLlmSettings);
  const [savedKey, setSavedKey] = useState<string | undefined>();
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");

  // localStorage is only there in the browser, after the static HTML has hydrated.
  useEffect(() => {
    const saved = getLlmSettings();
    setSettings(saved);
    setSavedKey(saved.key);
  }, []);

  const update = (patch: Partial<LlmSettings>) => setSettings((current) => ({ ...current, ...patch }));
  const updateRole = (role: LlmRole, model: string) =>
    setSettings((current) => ({ ...current, roleModels: { ...current.roleModels, [role]: model } }));

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      // An empty field keeps the saved key; "Remove key" clears it.
      const next = { ...settings, key: key.trim() || savedKey };
      saveLlmSettings(next);
      setSavedKey(next.key);
      setKey("");
      toast.success("Language model settings saved.");
    } catch (cause) {
      setError(cause instanceof LlmSettingsError ? cause.message : "Unable to save the settings.");
    }
  }

  function removeKey() {
    try {
      saveLlmSettings({ ...settings, key: undefined });
      setSavedKey(undefined);
      setKey("");
      toast.success("Key removed from this browser.");
    } catch (cause) {
      setError(cause instanceof LlmSettingsError ? cause.message : "Unable to remove the key.");
    }
  }

  function reset() {
    resetLlmSettings();
    setSettings(defaultLlmSettings());
    setSavedKey(undefined);
    setKey("");
    setError("");
    toast.success("Language model settings reset.");
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Endpoint and key</CardTitle>
          <CardDescription>
            Runs call the model through 9router. The key is saved in this browser only and sent to the worker with each
            start or resume; the worker never stores it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-base`}>Endpoint</FieldLabel>
              <Input
                id={`${id}-base`}
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={settings.baseUrl}
                onChange={(event) => update({ baseUrl: event.target.value })}
                placeholder="https://9router.example/v1"
              />
              <FieldDescription>An OpenAI-compatible base URL, ending before /chat/completions.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-key`}>API key</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id={`${id}-key`}
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  placeholder={savedKey ? `Saved (${maskKey(savedKey)}). Type to replace it.` : "sk-…"}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={showKey ? "Hide the key" : "Show the key"}
                  aria-pressed={showKey}
                  onClick={() => setShowKey((shown) => !shown)}
                >
                  {showKey ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>
              <FieldDescription>
                {savedKey ? "A key is saved in this browser." : "No key yet: runs can't start until one is saved."}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-model`}>Default model</FieldLabel>
              <Input
                id={`${id}-model`}
                autoComplete="off"
                spellCheck={false}
                value={settings.model}
                onChange={(event) => update({ model: event.target.value })}
                placeholder="cx/gpt-6-luna"
              />
              <FieldDescription>Used by every stage, and by any agent below left empty.</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Models per agent</CardTitle>
          <CardDescription>Optional. The hypothesis stage can give each of its agents its own model.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldSet>
            <FieldLegend className="sr-only">Models per agent</FieldLegend>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              {LLM_ROLES.map((role) => (
                <Field key={role}>
                  <FieldLabel htmlFor={`${id}-${role}`}>{ROLE_LABELS[role].label}</FieldLabel>
                  <Input
                    id={`${id}-${role}`}
                    autoComplete="off"
                    spellCheck={false}
                    value={settings.roleModels[role] ?? ""}
                    onChange={(event) => updateRole(role, event.target.value)}
                    placeholder={settings.model || "Default model"}
                  />
                  <FieldDescription>{ROLE_LABELS[role].line}</FieldDescription>
                </Field>
              ))}
            </FieldGroup>
          </FieldSet>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2">
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={reset}>
              Reset
            </Button>
            {savedKey && (
              <Button type="button" variant="outline" onClick={removeKey}>
                Remove key
              </Button>
            )}
            <Button type="submit">Save</Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
