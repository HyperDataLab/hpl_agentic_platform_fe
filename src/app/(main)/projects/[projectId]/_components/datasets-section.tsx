"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useInfiniteDatasets } from "@/hooks/use-datasets-query";

import { DatasetConnectionImport } from "./dataset-connection-import";
import { DatasetLibrary } from "./dataset-library";
import { DatasetUpload } from "./dataset-upload";
import { LoadMore, type WorkspaceProps } from "./workspace-ui";

export function DatasetsSection({ project, canWrite, userId }: WorkspaceProps) {
  const query = useInfiniteDatasets(project.id);
  const [picking, setPicking] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const hasDatasets = query.datasets.length > 0;

  return (
    <section
      className="flex min-w-0 flex-col gap-6"
      aria-label="Datasets drop area"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files).filter((file) => /\.(csv|xlsx|xls)$/i.test(file.name));
        if (files.length) setDroppedFiles(files);
      }}
    >
      {canWrite && (
        <>
          <DatasetUpload
            projectId={project.id}
            compact={hasDatasets || query.isPending}
            onImport={() => setPicking(true)}
            incomingFiles={droppedFiles}
            onIncomingFilesHandled={() => setDroppedFiles([])}
          />
          <DatasetConnectionImport
            project={project}
            userId={userId}
            canWrite={canWrite}
            picking={picking}
            onPickingChange={setPicking}
          />
        </>
      )}
      {query.isError && !hasDatasets ? (
        <Button variant="outline" className="self-start" onClick={() => void query.refetch()}>
          Reload datasets
        </Button>
      ) : (
        <DatasetLibrary
          projectId={project.id}
          datasets={query.datasets}
          canWrite={canWrite}
          pending={query.isPending}
          footer={
            query.hasNextPage ? <LoadMore visible pending={query.isFetching} onClick={query.loadMore} /> : undefined
          }
        />
      )}
    </section>
  );
}
