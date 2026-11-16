"use client";

import { useMemo, useState } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { HardDrive, KeyRound, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { showApiError } from "@/hooks/use-api";
import { deniedRedirect, fetchNodeDevices, parseNodeSignIn } from "@/lib/api/services/fetch-node-devices";

/** Consent page the Local Node opens in the system browser (OAuth 2.0 + PKCE, RFC 8252). */
export function AuthorizeNode({ email }: { email: string }) {
  const params = useSearchParams();
  const request = useMemo(() => parseNodeSignIn(new URLSearchParams(params.toString())), [params]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"approved" | "declined" | null>(null);

  if (!request) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-16">
        <h1 className="font-semibold text-xl">This sign-in link is not valid</h1>
        <p className="text-muted-foreground text-sm">
          Open Logos Local Node on your computer and choose Sign in with Logos again. Only the app itself can start a
          sign-in.
        </p>
        <Button asChild variant="outline" className="self-start">
          <Link href="/devices">Your Local Nodes</Link>
        </Button>
      </main>
    );
  }

  const approve = async () => {
    setBusy(true);
    try {
      const response = await fetchNodeDevices.authorize(request);
      setDone("approved");
      // The Node's loopback listener takes the one-time code and closes.
      window.location.assign(response.data.redirect_to);
    } catch (error) {
      showApiError(error);
      setBusy(false);
    }
  };

  const decline = () => {
    setDone("declined");
    window.location.assign(deniedRedirect(request));
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <HardDrive className="size-8 text-muted-foreground" aria-hidden />
        <h1 className="font-semibold text-xl">Sign in to Logos Local Node?</h1>
        <p className="text-muted-foreground text-sm">
          <span className="font-medium text-foreground">{request.device_name}</span> asks to sign in as{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>
      </div>
      <ul className="flex flex-col gap-3 text-sm">
        <li className="flex gap-3">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>This computer gets its own device key. You can remove it any time in Your Local Nodes.</span>
        </li>
        <li className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Signing in shares no data. You still connect each project in the app, and a Project Manager approves a
            Researcher's computer. Rows never leave the computer; only aggregates that pass its release checks do.
          </span>
        </li>
      </ul>
      <p className="text-muted-foreground text-xs">
        Only continue if you just chose Sign in with Logos in the Local Node app on this computer.
      </p>
      {done ? (
        <p role="status" className="text-sm">
          {done === "approved" ? "Approved. Return to Logos Local Node." : "Declined. You can close this tab."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void approve()} disabled={busy}>
            Sign in to Local Node
          </Button>
          <Button variant="outline" onClick={decline} disabled={busy}>
            Cancel
          </Button>
        </div>
      )}
    </main>
  );
}
