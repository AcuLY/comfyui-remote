"use client";

import { useState } from "react";

import { buildProjectReferenceUploadPreview, type ReferenceCandidate } from "./project-page-utils";

export type ProjectReferenceUploadDraft = {
  file: File;
  id: string;
  previewReference: ReferenceCandidate;
  title: string;
};

export function useProjectReferenceUploadDrafts(templateContextId: string) {
  const [projectReferenceUploadState, setProjectReferenceUploadState] = useState(() => ({
    templateContextId,
    uploads: [] as ProjectReferenceUploadDraft[],
  }));
  const stagedProjectReferenceUploads = projectReferenceUploadState.templateContextId === templateContextId
    ? projectReferenceUploadState.uploads
    : [];

  function stageProjectReferenceUploadFiles(files: File[]) {
    const nextUploads: ProjectReferenceUploadDraft[] = [];
    setProjectReferenceUploadState((current) => {
      const activeUploads = current.templateContextId === templateContextId ? current.uploads : [];
      const uploads = [...activeUploads];

      files.forEach((file) => {
        const duplicate = uploads.some((upload) => (
          upload.file.name === file.name
          && upload.file.size === file.size
          && upload.file.lastModified === file.lastModified
        ));
        if (duplicate) return;

        const id = `staged-upload-${Date.now()}-${uploads.length + 1}`;
        const nextUpload = {
          file,
          id,
          previewReference: buildProjectReferenceUploadPreview(file, id),
          title: file.name.replace(/\.[^.]+$/, "") || "本地上传图片",
        } satisfies ProjectReferenceUploadDraft;
        uploads.push(nextUpload);
        nextUploads.push(nextUpload);
      });

      return {
        templateContextId,
        uploads,
      };
    });

    return nextUploads;
  }

  return {
    stagedProjectReferenceUploads,
    stageProjectReferenceUploadFiles,
  };
}
