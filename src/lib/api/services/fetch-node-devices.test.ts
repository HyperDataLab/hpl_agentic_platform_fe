import { beforeEach, describe, expect, it, vi } from "vitest";

import apiService from "../core";
import { deniedRedirect, fetchNodeDevices, parseNodeSignIn } from "./fetch-node-devices";

vi.mock("../core", () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

const good = {
  client_id: "logos-local-node",
  redirect_uri: "http://127.0.0.1:53682/callback",
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256",
  state: "abcdefghijklmnopqrstuvwx",
  device_name: "LAB-PC",
};

describe("Local Node sign-in request", () => {
  it("accepts only the Node's loopback callback with PKCE S256", () => {
    expect(parseNodeSignIn(new URLSearchParams(good))).toEqual(good);
    for (const bad of [
      { redirect_uri: "https://evil.example/callback" },
      { redirect_uri: "http://localhost:53682/callback" },
      { redirect_uri: "http://127.0.0.1:80/callback" },
      { redirect_uri: "http://127.0.0.1:53682/other" },
      { code_challenge_method: "plain" },
      { code_challenge: "short" },
      { state: "x" },
      { client_id: "something-else" },
    ]) {
      expect(parseNodeSignIn(new URLSearchParams({ ...good, ...bad }))).toBeNull();
    }
  });

  it("sends a declined sign-in back to the Node with its state", () => {
    const request = parseNodeSignIn(new URLSearchParams(good));
    expect(request && deniedRedirect(request)).toBe(
      "http://127.0.0.1:53682/callback?error=access_denied&state=abcdefghijklmnopqrstuvwx",
    );
  });

  it("uses the account's device routes", async () => {
    vi.mocked(apiService.post).mockResolvedValue({ data: { success: true } } as Awaited<
      ReturnType<typeof apiService.post>
    >);
    vi.mocked(apiService.delete).mockResolvedValue({} as Awaited<ReturnType<typeof apiService.delete>>);
    const request = parseNodeSignIn(new URLSearchParams(good));
    if (!request) throw new Error("expected a valid request");
    await fetchNodeDevices.authorize(request);
    expect(apiService.post).toHaveBeenCalledWith("/node-auth/authorize", request);
    await fetchNodeDevices.revoke("d/1");
    expect(apiService.delete).toHaveBeenCalledWith("/users/me/node-devices/d%2F1");
  });
});
