import { CalendarDays, Check, Hash, Type } from "lucide-react";

import type { ColumnKind } from "./dataset-preview";

const columnKindIcons = {
  number: Hash,
  text: Type,
  date: CalendarDays,
  boolean: Check,
} satisfies Record<ColumnKind, typeof Hash>;

export function ColumnKindIcon({ kind, className }: { kind: ColumnKind; className?: string }) {
  const Icon = columnKindIcons[kind];
  return <Icon aria-hidden="true" className={className} />;
}
