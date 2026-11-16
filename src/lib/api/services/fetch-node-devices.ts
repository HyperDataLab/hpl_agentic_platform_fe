import type { ApiResult } from "@/types/api";

import apiService from "../core";

/** What the Local Node put in the browser address when it asked to sign in. */
export interface NodeSignInRequest {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string;
  device_name: string;
}

export interface NodeDevice {
  id: string;
  name: string;
  node_version: string;
  created_at: string;
  last_seen_at: string | null;
  revoked: boolean;
  /** Ids of the projects this device is connected to. */
  projects: string[];
}

export const NODE_CLIENT_ID = "logos-local-node";
/** Only the Local Node's own loopback address may receive a sign-in code (RFC 8252). */
const LOOPBACK_CALLBACK = /^http:\/\/127\.0\.0\.1:\d{4,5}\/callback$/;
const LOOPBACK_PREFIX = "http://127.0.0.1:";
const CALLBACK_PATH = "/callback";
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** The sign-in request from the page's query, or null when anything is missing or unsafe. */
export function parseNodeSignIn(params: URLSearchParams): NodeSignInRequest | null {
  const read = (name: string) => params.get(name) ?? "";
  const request: NodeSignInRequest = {
    client_id: read("client_id"),
    redirect_uri: read("redirect_uri"),
    code_challenge: read("code_challenge"),
    code_challenge_method: read("code_challenge_method"),
    state: read("state"),
    device_name: read("device_name").trim().slice(0, 160) || "Local Node",
  };
  const loopback = LOOPBACK_CALLBACK.test(request.redirect_uri);
  const port = loopback ? Number(request.redirect_uri.slice(LOOPBACK_PREFIX.length, -CALLBACK_PATH.length)) : 0;
  const valid =
    request.client_id === NODE_CLIENT_ID &&
    port >= 1024 &&
    port <= 65535 &&
    request.code_challenge_method === "S256" &&
    request.code_challenge.length === 43 &&
    BASE64URL.test(request.code_challenge) &&
    request.state.length >= 16 &&
    request.state.length <= 128 &&
    BASE64URL.test(request.state);
  return valid ? request : null;
}

/** Where to send the browser when the user declines: the Node stops waiting. */
export function deniedRedirect(request: NodeSignInRequest): string {
  return `${request.redirect_uri}?${new URLSearchParams({ error: "access_denied", state: request.state })}`;
}

export const fetchNodeDevices = {
  authorize: async (request: NodeSignInRequest): Promise<ApiResult<{ redirect_to: string }>> =>
    (await apiService.post<ApiResult<{ redirect_to: string }>>("/node-auth/authorize", request)).data,
  list: async (signal?: AbortSignal): Promise<ApiResult<NodeDevice[]>> =>
    (await apiService.get<ApiResult<NodeDevice[]>>("/users/me/node-devices", undefined, { signal })).data,
  revoke: async (deviceId: string): Promise<void> => {
    await apiService.delete(`/users/me/node-devices/${encodeURIComponent(deviceId)}`);
  },
};
