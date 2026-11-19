"use client";

import type { NotificationItem } from "@/lib/api/services/fetch-notifications";

/** How the notification bell is fed. "offline": there is no notification stream. */
export type NotificationConnectionStatus = "connected" | "connecting" | "reconnecting" | "offline";

/**
 * The notification bell's feed. The old Platform pushed notifications over SSE; the i2h-worker has no notification
 * stream yet, so the bell stays disabled. Run news still shows as toasts from the run's own stream.
 */
export function useSignalRNotifications(): {
  items: NotificationItem[];
  unreadCount: number;
  hasSnapshot: boolean;
  status: NotificationConnectionStatus;
  isAuthenticated: boolean;
} {
  return { items: [], unreadCount: 0, hasSnapshot: true, status: "offline", isAuthenticated: false };
}
