"use client";

import { useState } from "react";

import type { SupplementalImageAttachment } from "./project-page-utils";

type GenerationSupplementalImagesState = {
  attachments: SupplementalImageAttachment[];
  projectId: string | null;
  sectionId: string | null;
};

export function useGenerationSupplementalImages(projectId: string | null, sectionId: string | null) {
  const [supplementalImageAttachmentState, setSupplementalImageAttachments] = useState<GenerationSupplementalImagesState>(() => ({
    attachments: [],
    projectId,
    sectionId,
  }));
  const supplementalImageAttachments = supplementalImageAttachmentState.projectId === projectId && supplementalImageAttachmentState.sectionId === sectionId
    ? supplementalImageAttachmentState.attachments
    : [];

  function addSupplementalImage(candidate: SupplementalImageAttachment) {
    setSupplementalImageAttachments((current) => {
      const activeAttachments = current.projectId === projectId && current.sectionId === sectionId ? current.attachments : [];
      if (activeAttachments.some((attachment) => attachment.id === candidate.id)) {
        return {
          attachments: activeAttachments,
          projectId,
          sectionId,
        };
      }
      return {
        attachments: [...activeAttachments, candidate],
        projectId,
        sectionId,
      };
    });
  }

  function removeLocalSupplementalImage(attachmentId: string) {
    setSupplementalImageAttachments((current) => ({
      attachments: current.projectId === projectId && current.sectionId === sectionId
        ? current.attachments.filter((attachment) => attachment.id !== attachmentId)
        : [],
      projectId,
      sectionId,
    }));
  }

  return {
    addSupplementalImage,
    removeLocalSupplementalImage,
    supplementalImageAttachments,
  };
}
