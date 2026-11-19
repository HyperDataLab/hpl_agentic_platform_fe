"use client";

import { getClientCookie } from "../cookie.client";
import {
  getPreferencePersistence,
  PREFERENCE_REGISTRY,
  type PreferenceKey,
  type PreferenceValueMap,
  parsePreference,
} from "./preferences-config";

/** A preference as the browser keeps it, or its default. Call after hydration: the static HTML has the defaults. */
export function readPreference<K extends PreferenceKey>(key: K): PreferenceValueMap[K] {
  const persistence = getPreferencePersistence(key);
  if (persistence !== "client-cookie" && persistence !== "server-cookie") {
    return PREFERENCE_REGISTRY[key].defaultValue as PreferenceValueMap[K];
  }
  return parsePreference(key, getClientCookie(key)?.trim());
}

/** Whether the sidebar was left open: the sidebar writes `sidebar_state` when it is toggled. */
export function readSidebarOpen() {
  return getClientCookie("sidebar_state") !== "false";
}
