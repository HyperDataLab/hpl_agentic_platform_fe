"use client";

import { useEffect, useState } from "react";

import { cn } from "cn";

import { DialogScrollArea } from "@/components/dialog-scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/use-api";
import { useDatasetAccessRefresh, useProjectAccess } from "@/hooks/use-project-access";
import { projectKeys } from "@/lib/api/query-keys";
import { type DatasetPreviewData, type DatasetVersionItem, fetchDatasets } from "@/lib/api/services/fetch-datasets";

import { ColumnKindIcon } from "./column-kind-icon";
import { inferColumnKind } from "./dataset-preview";
import { ListState } from "./workspace-ui";

export function DatasetCsvPreview({
  projectId,
  datasetId,
  version,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  inline = false,
  note = true,
  onPreviewData,
}: {
  projectId: string;
  datasetId: string;
  version: DatasetVersionItem;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  inline?: boolean;
  /** The line on what the preview leaves out; off when the caller says it elsewhere. */
  note?: boolean;
  onPreviewData?: (data: DatasetPreviewData | undefined) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const access = useProjectAccess(projectId);
  const canRead = Boolean(access.context?.permissions.can_read_raw_datasets);
  const changeOpen = (value: boolean) => {
    setLocalOpen(value);
    onOpenChange?.(value);
  };
  const query = useApiQuery(
    [
      ...projectKeys.dataset(projectId, datasetId),
      "preview",
      version.id,
      access.userId,
      access.context?.settings_version,
    ],
    (signal) => fetchDatasets.preview(projectId, datasetId, version.id, signal),
    { enabled: canRead && (inline ? true : open), gcTime: 0 },
  );
  useDatasetAccessRefresh(projectId, query.error);
  const preview = !query.isError && canRead ? query.data?.data : undefined;
  useEffect(() => {
    onPreviewData?.(preview);
  }, [onPreviewData, preview]);
  const rows = preview ? [preview.columns.slice(0, 50), ...preview.rows] : [];
  if (!canRead) return null;

  const content = (
    <div className="flex min-h-0 min-w-0 flex-col gap-3">
      <ListState
        pending={query.isFetching && !query.data}
        failed={query.isError}
        empty={!query.isFetching && !query.isError && rows.length <= 1}
        title="CSV rows"
        retry={query.refetch}
      />
      {rows.length > 1 && (
        <DialogScrollArea
          horizontal
          contentLabel="CSV preview table"
          className={cn("max-h-[min(65dvh,36rem)] rounded-lg border border-border", !inline && "max-h-[55dvh]")}
          contentClassName="p-0!"
        >
          <Table>
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow>
                <TableHead className="w-12 text-muted-foreground/70">Row</TableHead>
                {rows[0].map((column, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Column positions are fixed in this immutable preview.
                  <TableHead key={index} className="min-w-36 whitespace-normal break-words">
                    <span className="flex items-center gap-1.5">
                      <ColumnKindIcon
                        kind={inferColumnKind(rows.slice(1).map((row) => row[index] ?? ""))}
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <span>{column || `Column ${index + 1}`}</span>
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(1).map((row, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Row coordinates are stable in this unsorted preview.
                <TableRow key={index}>
                  <TableCell className="align-top text-muted-foreground">{index + 1}</TableCell>
                  {rows[0].map((_, column) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: Duplicate CSV values are valid; column position identifies each cell.
                    <TableCell key={column} className="max-w-80 whitespace-pre-wrap break-words align-top">
                      {row[column] ?? ""}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogScrollArea>
      )}
      {note && (
        <p className="text-muted-foreground text-xs">
          Preview shows up to 100 rows and 50 columns from the first 1 MiB. Download CSV to view the complete dataset.
        </p>
      )}
      {preview?.masking_applied && (
        <p className="text-muted-foreground text-xs">
          Personal data is masked in this preview. Authorized downloads contain the original data.
        </p>
      )}
      {preview?.truncated && (
        <p className="text-muted-foreground text-xs">More rows are available in the full dataset.</p>
      )}
    </div>
  );

  if (inline) return content;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Preview CSV
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[85dvh] min-w-0 flex-col gap-4 overflow-hidden sm:max-w-5xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="break-words">{version.original_filename}</DialogTitle>
          <DialogDescription>
            Version {version.version_number} · {version.row_count.toLocaleString()} rows · {version.column_names.length}{" "}
            columns
          </DialogDescription>
        </DialogHeader>
        {content}
        <DialogFooter className="shrink-0">
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
          <Button asChild variant="outline">
            <a href={fetchDatasets.getVersionDownloadUrl(projectId, datasetId, version.id)}>Download CSV</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
