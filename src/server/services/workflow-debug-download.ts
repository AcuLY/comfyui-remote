type JsonRecord = Record<string, unknown>;

export type WorkflowDownloadVariant = "original" | "debug";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJsonRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function asNode(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function isNodeLink(value: unknown): value is [string, number] {
  return Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "string" &&
    typeof value[1] === "number";
}

function linksEqual(value: unknown, nodeId: string, outputIndex: number) {
  return isNodeLink(value) && value[0] === nodeId && value[1] === outputIndex;
}

function nextAvailableNodeId(workflow: JsonRecord, usedIds: Set<string>) {
  let maxId = 0;
  for (const id of Object.keys(workflow)) {
    if (/^\d+$/.test(id)) {
      maxId = Math.max(maxId, Number(id));
    }
  }

  let nextId = maxId + 1;
  while (usedIds.has(String(nextId))) {
    nextId += 1;
  }
  usedIds.add(String(nextId));
  return String(nextId);
}

function findKSampler1NodeId(workflow: JsonRecord) {
  for (const [id, rawNode] of Object.entries(workflow)) {
    const node = asNode(rawNode);
    const meta = asNode(node?._meta);
    if (node?.class_type === "KSampler" && meta?.title === "KSampler1") {
      return id;
    }
  }

  const defaultNode = asNode(workflow["3"]);
  return defaultNode?.class_type === "KSampler" ? "3" : null;
}

function findVaeInput(workflow: JsonRecord): [string, number] {
  for (const rawNode of Object.values(workflow)) {
    const node = asNode(rawNode);
    if (node?.class_type !== "VAEDecode") continue;

    const vae = asNode(node.inputs)?.vae;
    if (isNodeLink(vae)) {
      return [vae[0], vae[1]];
    }
  }

  return ["1", 2];
}

function hasKSamplerPreviewBranch(workflow: JsonRecord, kSamplerNodeId: string, vaeInput: [string, number]) {
  for (const [decodeId, rawNode] of Object.entries(workflow)) {
    const node = asNode(rawNode);
    const inputs = asNode(node?.inputs);
    if (
      node?.class_type !== "VAEDecode" ||
      !linksEqual(inputs?.samples, kSamplerNodeId, 0) ||
      !linksEqual(inputs?.vae, vaeInput[0], vaeInput[1])
    ) {
      continue;
    }

    const hasPreview = Object.values(workflow).some((rawPreviewNode) => {
      const previewNode = asNode(rawPreviewNode);
      return previewNode?.class_type === "PreviewImage" &&
        linksEqual(asNode(previewNode.inputs)?.images, decodeId, 0);
    });

    if (hasPreview) {
      return true;
    }
  }

  return false;
}

function convertSaveImageNodes(workflow: JsonRecord) {
  for (const rawNode of Object.values(workflow)) {
    const node = asNode(rawNode);
    if (!node || (node.class_type !== "Image Save" && node.class_type !== "SaveImage")) {
      continue;
    }

    const inputs = asNode(node.inputs);
    const images = inputs?.images;
    node.class_type = "PreviewImage";
    node.inputs = images === undefined ? {} : { images };
    node._meta = {
      ...(asNode(node._meta) ?? {}),
      title: "Preview Image",
    };
  }
}

function addKSampler1PreviewBranch(workflow: JsonRecord) {
  const kSamplerNodeId = findKSampler1NodeId(workflow);
  if (!kSamplerNodeId) {
    return;
  }

  const vaeInput = findVaeInput(workflow);
  if (hasKSamplerPreviewBranch(workflow, kSamplerNodeId, vaeInput)) {
    return;
  }

  const usedIds = new Set(Object.keys(workflow));
  const decodeId = nextAvailableNodeId(workflow, usedIds);
  const previewId = nextAvailableNodeId(workflow, usedIds);

  workflow[decodeId] = {
    inputs: {
      samples: [kSamplerNodeId, 0],
      vae: [...vaeInput],
    },
    class_type: "VAEDecode",
    _meta: {
      title: "KSampler1 VAE Decode",
    },
  };

  workflow[previewId] = {
    inputs: {
      images: [decodeId, 0],
    },
    class_type: "PreviewImage",
    _meta: {
      title: "KSampler1 Preview Image",
    },
  };
}

export function buildDebugWorkflowPrompt(workflow: Record<string, unknown>): Record<string, unknown> {
  const debugWorkflow = cloneJsonRecord(workflow);

  convertSaveImageNodes(debugWorkflow);
  addKSampler1PreviewBranch(debugWorkflow);

  return debugWorkflow;
}

export function getWorkflowDownloadVariant(requestUrl: string): WorkflowDownloadVariant {
  const url = new URL(requestUrl);
  return url.searchParams.get("variant") === "debug" ? "debug" : "original";
}

export function buildWorkflowDownloadPayload(
  workflow: Record<string, unknown>,
  variant: WorkflowDownloadVariant,
) {
  return variant === "debug" ? buildDebugWorkflowPrompt(workflow) : workflow;
}

export function appendWorkflowVariantSuffix(fileStem: string, variant: WorkflowDownloadVariant) {
  return variant === "debug" ? `${fileStem}-debug` : fileStem;
}
