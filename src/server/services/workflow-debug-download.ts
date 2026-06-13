type JsonRecord = Record<string, unknown>;

type GraphLink = [number, number, number, number, number, string];

type GraphNodeInput = {
  name: string;
  type: string;
  link: number | null;
  dir?: number;
  widget?: { name: string };
};

type GraphNodeOutput = {
  name: string;
  type: string;
  links: number[] | null;
  dir?: number;
  shape?: number;
};

type GraphNode = {
  id: number;
  type: string;
  pos: [number, number];
  size: [number, number];
  flags: JsonRecord;
  order: number;
  mode: number;
  inputs: GraphNodeInput[];
  outputs: GraphNodeOutput[];
  title?: string;
  properties: JsonRecord;
  widgets_values: unknown[];
};

type FrontendGraphWorkflow = {
  id: string;
  revision: number;
  last_node_id: number;
  last_link_id: number;
  nodes: GraphNode[];
  links: GraphLink[];
  groups: unknown[];
  config: JsonRecord;
  extra: JsonRecord;
  version: number;
};

export type WorkflowDownloadVariant = "original" | "debug";

const DEBUG_LINKS: GraphLink[] = [
  [28, 522, 0, 3, 0, "MODEL"],
  [29, 4, 0, 3, 1, "CONDITIONING"],
  [30, 12, 0, 3, 2, "CONDITIONING"],
  [31, 407, 0, 3, 3, "LATENT"],
  [32, 511, 0, 4, 1, "STRING"],
  [33, 522, 1, 4, 0, "CLIP"],
  [34, 513, 0, 12, 1, "STRING"],
  [35, 522, 1, 12, 0, "CLIP"],
  [36, 1, 0, 36, 0, "MODEL"],
  [37, 1, 1, 36, 1, "CLIP"],
  [38, 427, 0, 410, 0, "LATENT"],
  [39, 1, 2, 410, 1, "VAE"],
  [40, 3, 0, 425, 0, "LATENT"],
  [41, 36, 0, 427, 0, "MODEL"],
  [42, 519, 0, 427, 1, "CONDITIONING"],
  [43, 520, 0, 427, 2, "CONDITIONING"],
  [44, 425, 0, 427, 3, "LATENT"],
  [45, 410, 0, 515, 0, "IMAGE"],
  [46, 511, 0, 519, 1, "STRING"],
  [47, 36, 1, 519, 0, "CLIP"],
  [48, 513, 0, 520, 1, "STRING"],
  [49, 36, 1, 520, 0, "CLIP"],
  [50, 1, 0, 522, 0, "MODEL"],
  [51, 1, 1, 522, 1, "CLIP"],
  [52, 3, 0, 523, 0, "LATENT"],
  [53, 1, 2, 523, 1, "VAE"],
  [54, 523, 0, 524, 0, "IMAGE"],
  [55, 526, 0, 527, 0, "INT"],
  [56, 527, 0, 407, 0, "INT"],
  [57, 528, 0, 527, 1, "INT"],
  [58, 529, 0, 527, 2, "BOOLEAN"],
  [61, 532, 0, 407, 1, "INT"],
  [64, 528, 0, 532, 0, "INT"],
  [65, 526, 0, 532, 1, "INT"],
  [66, 533, 0, 534, 0, "INT"],
  [67, 535, 0, 534, 1, "INT"],
  [68, 535, 0, 536, 0, "INT"],
  [69, 533, 0, 536, 1, "INT"],
  [70, 534, 0, 425, 1, "INT"],
  [71, 536, 0, 425, 2, "INT"],
  [72, 529, 0, 532, 2, "BOOLEAN"],
  [73, 529, 0, 534, 2, "BOOLEAN"],
  [74, 529, 0, 536, 2, "BOOLEAN"],
];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJsonRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function apiNode(workflow: JsonRecord, id: string): JsonRecord {
  const node = workflow[id];
  return isRecord(node) ? node : {};
}

function apiInputs(workflow: JsonRecord, id: string): JsonRecord {
  const inputs = apiNode(workflow, id).inputs;
  return isRecord(inputs) ? inputs : {};
}

function stringInput(workflow: JsonRecord, id: string, key: string, fallback = "") {
  const value = apiInputs(workflow, id)[key];
  return typeof value === "string" ? value : fallback;
}

function numberInput(workflow: JsonRecord, id: string, key: string, fallback: number) {
  const value = apiInputs(workflow, id)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatPromptBlockBreaks(prompt: string) {
  return prompt.replaceAll(" BREAK ", " BREAK\n\n");
}

function outgoingLinks(nodeId: number, outputSlot: number) {
  const links = DEBUG_LINKS.filter((link) => link[1] === nodeId && link[2] === outputSlot).map((link) => link[0]);
  return links.length > 0 ? links : null;
}

function input(name: string, type: string, link: number | null, widgetName?: string, dir?: number): GraphNodeInput {
  return {
    ...(dir === undefined ? {} : { dir }),
    name,
    type,
    ...(widgetName ? { widget: { name: widgetName } } : {}),
    link,
  };
}

function output(name: string, type: string, nodeId: number, outputSlot: number, shape?: number, dir?: number): GraphNodeOutput {
  return {
    ...(dir === undefined ? {} : { dir }),
    name,
    ...(shape === undefined ? {} : { shape }),
    type,
    links: outgoingLinks(nodeId, outputSlot),
  };
}

function coreProperties(nodeName: string): JsonRecord {
  return {
    cnr_id: "comfy-core",
    ver: "0.20.1",
    "Node name for S&R": nodeName,
    ue_properties: {
      widget_ue_connectable: {},
      input_ue_unconnectable: {},
      version: "7.5.2",
    },
  };
}

function textProperties(): JsonRecord {
  return {
    cnr_id: "was-ns",
    ver: "3.0.1",
    "Node name for S&R": "Text Multiline",
    ue_properties: {
      widget_ue_connectable: {},
      input_ue_unconnectable: {},
      version: "7.5.2",
    },
  };
}

function loraProperties(): JsonRecord {
  return {
    cnr_id: "rgthree-comfy",
    ver: "1.0.2512112053",
    "Show Strengths": "Single Strength",
    ue_properties: {
      widget_ue_connectable: {},
      input_ue_unconnectable: {},
      version: "7.5.2",
    },
  };
}

function easyUseProperties(): JsonRecord {
  return {
    cnr_id: "comfyui-easy-use",
    ver: "1.3.5",
    ue_properties: {
      widget_ue_connectable: {},
      input_ue_unconnectable: {},
    },
    "Node name for S&R": "easy ifElse",
  };
}

function createNode(node: Omit<GraphNode, "flags" | "mode">): GraphNode {
  return {
    ...node,
    flags: {},
    mode: 0,
  };
}

function loraWidgets(workflow: JsonRecord, nodeId: string) {
  const inputs = apiInputs(workflow, nodeId);
  const loraEntries = Object.keys(inputs)
    .filter((key) => /^lora_\d+$/.test(key))
    .sort((left, right) => Number(left.slice(5)) - Number(right.slice(5)))
    .flatMap((key) => {
      const value = inputs[key];
      if (!isRecord(value)) {
        return [];
      }

      return [{
        on: value.on !== false,
        lora: typeof value.lora === "string" ? value.lora : "",
        strength: typeof value.strength === "number" ? value.strength : 1,
        strengthTwo: isRecord(value) && "strengthTwo" in value ? value.strengthTwo : null,
      }];
    });

  return [
    {},
    { type: "PowerLoraLoaderHeaderWidget" },
    ...loraEntries,
    {},
    "",
  ];
}

function kSamplerWidgets(workflow: JsonRecord, nodeId: string, fallbackCfg: number, fallbackDenoise: number) {
  return [
    numberInput(workflow, nodeId, "seed", 0),
    "randomize",
    numberInput(workflow, nodeId, "steps", 30),
    numberInput(workflow, nodeId, "cfg", fallbackCfg),
    stringInput(workflow, nodeId, "sampler_name", "euler_ancestral"),
    stringInput(workflow, nodeId, "scheduler", "karras"),
    numberInput(workflow, nodeId, "denoise", fallbackDenoise),
  ];
}

function dimensionControls(workflow: JsonRecord) {
  const baseWidth = numberInput(workflow, "407", "width", 512);
  const baseHeight = numberInput(workflow, "407", "height", 768);
  const upscaleWidth = numberInput(workflow, "425", "width", Math.round((baseWidth * 2) / 8) * 8);
  const upscaleHeight = numberInput(workflow, "425", "height", Math.round((baseHeight * 2) / 8) * 8);

  return {
    vertical: baseHeight >= baseWidth,
    portraitWidth: Math.min(baseWidth, baseHeight),
    portraitHeight: Math.max(baseWidth, baseHeight),
    upscalePortraitWidth: Math.min(upscaleWidth, upscaleHeight),
    upscalePortraitHeight: Math.max(upscaleWidth, upscaleHeight),
  };
}

function buildDebugGraphWorkflow(workflow: JsonRecord): FrontendGraphWorkflow {
  const dimensions = dimensionControls(workflow);
  const positivePrompt = formatPromptBlockBreaks(stringInput(workflow, "511", "text"));
  const negativePrompt = formatPromptBlockBreaks(stringInput(workflow, "513", "text"));
  const batchSize = numberInput(workflow, "407", "batch_size", 1);

  const nodes: GraphNode[] = [
    createNode({
      id: 1,
      type: "CheckpointLoaderSimple",
      pos: [100, 130],
      size: [270, 98],
      order: 0,
      inputs: [],
      outputs: [
        output("MODEL", "MODEL", 1, 0),
        output("CLIP", "CLIP", 1, 1),
        output("VAE", "VAE", 1, 2),
      ],
      properties: coreProperties("CheckpointLoaderSimple"),
      widgets_values: [stringInput(workflow, "1", "ckpt_name", "oneObsession_v19Atypical.safetensors")],
    }),
    createNode({
      id: 3,
      type: "KSampler",
      pos: [1540.519921875, 130],
      size: [270, 262],
      order: 19,
      inputs: [
        input("model", "MODEL", 28),
        input("positive", "CONDITIONING", 29),
        input("negative", "CONDITIONING", 30),
        input("latent_image", "LATENT", 31),
      ],
      outputs: [output("LATENT", "LATENT", 3, 0)],
      title: "KSampler1",
      properties: coreProperties("KSampler"),
      widgets_values: kSamplerWidgets(workflow, "3", 4, 1),
    }),
    createNode({
      id: 4,
      type: "CLIPTextEncode",
      pos: [1040.519921875, 790],
      size: [400, 200],
      order: 16,
      inputs: [
        input("clip", "CLIP", 33),
        input("text", "STRING", 32, "text"),
      ],
      outputs: [output("CONDITIONING", "CONDITIONING", 4, 0)],
      properties: coreProperties("CLIPTextEncode"),
      widgets_values: [""],
    }),
    createNode({
      id: 12,
      type: "CLIPTextEncode",
      pos: [1040.519921875, 1120],
      size: [400, 200],
      order: 17,
      inputs: [
        input("clip", "CLIP", 35),
        input("text", "STRING", 34, "text"),
      ],
      outputs: [output("CONDITIONING", "CONDITIONING", 12, 0)],
      properties: coreProperties("CLIPTextEncode"),
      widgets_values: [""],
    }),
    createNode({
      id: 36,
      type: "Power Lora Loader (rgthree)",
      pos: [600, 130],
      size: [340.519921875, 262],
      order: 8,
      inputs: [
        input("model", "MODEL", 36, undefined, 3),
        input("clip", "CLIP", 37, undefined, 3),
      ],
      outputs: [
        output("MODEL", "MODEL", 36, 0, 3, 4),
        output("CLIP", "CLIP", 36, 1, 3, 4),
      ],
      title: "lora 2",
      properties: loraProperties(),
      widgets_values: loraWidgets(workflow, "36"),
    }),
    createNode({
      id: 410,
      type: "VAEDecode",
      pos: [2650.519921875, 130],
      size: [140, 46],
      order: 24,
      inputs: [
        input("samples", "LATENT", 38),
        input("vae", "VAE", 39),
      ],
      outputs: [output("IMAGE", "IMAGE", 410, 0)],
      properties: coreProperties("VAEDecode"),
      widgets_values: [],
    }),
    createNode({
      id: 427,
      type: "KSampler",
      pos: [2280.519921875, 130],
      size: [270, 262],
      order: 22,
      inputs: [
        input("model", "MODEL", 41),
        input("positive", "CONDITIONING", 42),
        input("negative", "CONDITIONING", 43),
        input("latent_image", "LATENT", 44),
      ],
      outputs: [output("LATENT", "LATENT", 427, 0)],
      title: "KSampler2",
      properties: coreProperties("KSampler"),
      widgets_values: kSamplerWidgets(workflow, "427", 7, 0.6),
    }),
    createNode({
      id: 515,
      type: "PreviewImage",
      pos: [2890.519921875, 130],
      size: [140, 246],
      order: 25,
      inputs: [input("images", "IMAGE", 45)],
      outputs: [],
      properties: coreProperties("PreviewImage"),
      widgets_values: [],
    }),
    createNode({
      id: 519,
      type: "CLIPTextEncode",
      pos: [1040.519921875, 130],
      size: [400, 200],
      order: 14,
      inputs: [
        input("clip", "CLIP", 47),
        input("text", "STRING", 46, "text"),
      ],
      outputs: [output("CONDITIONING", "CONDITIONING", 519, 0)],
      properties: coreProperties("CLIPTextEncode"),
      widgets_values: [""],
    }),
    createNode({
      id: 520,
      type: "CLIPTextEncode",
      pos: [1040.519921875, 460],
      size: [400, 200],
      order: 15,
      inputs: [
        input("clip", "CLIP", 49),
        input("text", "STRING", 48, "text"),
      ],
      outputs: [output("CONDITIONING", "CONDITIONING", 520, 0)],
      properties: coreProperties("CLIPTextEncode"),
      widgets_values: [""],
    }),
    createNode({
      id: 523,
      type: "VAEDecode",
      pos: [1910.519921875, 390],
      size: [195.4107421875, 46],
      order: 21,
      inputs: [
        input("samples", "LATENT", 52),
        input("vae", "VAE", 53),
      ],
      outputs: [output("IMAGE", "IMAGE", 523, 0)],
      title: "KSampler1 VAE Decode",
      properties: coreProperties("VAEDecode"),
      widgets_values: [],
    }),
    createNode({
      id: 524,
      type: "PreviewImage",
      pos: [2280.519921875, 522],
      size: [210.3677734375, 246],
      order: 23,
      inputs: [input("images", "IMAGE", 54)],
      outputs: [],
      title: "KSampler1 Preview Image",
      properties: coreProperties("PreviewImage"),
      widgets_values: [],
    }),
    createNode({
      id: 522,
      type: "Power Lora Loader (rgthree)",
      pos: [600, 378],
      size: [340.519921875, 238],
      order: 9,
      inputs: [
        input("model", "MODEL", 50, undefined, 3),
        input("clip", "CLIP", 51, undefined, 3),
      ],
      outputs: [
        output("MODEL", "MODEL", 522, 0, 3, 4),
        output("CLIP", "CLIP", 522, 1, 3, 4),
      ],
      title: "lora 1",
      properties: loraProperties(),
      widgets_values: loraWidgets(workflow, "522"),
    }),
    createNode({
      id: 513,
      type: "Text Multiline",
      pos: [100.94397250201277, 1036.3339952952272],
      size: [400, 200],
      order: 1,
      inputs: [],
      outputs: [output("STRING", "STRING", 513, 0)],
      title: "negative prompt",
      properties: textProperties(),
      widgets_values: [negativePrompt],
    }),
    createNode({
      id: 511,
      type: "Text Multiline",
      pos: [100, 594],
      size: [469.890204496062, 355.55570532622846],
      order: 2,
      inputs: [],
      outputs: [output("STRING", "STRING", 511, 0)],
      title: "positive prompt",
      properties: textProperties(),
      widgets_values: [positivePrompt],
    }),
    createNode({
      id: 425,
      type: "LatentUpscale",
      pos: [1910.519921875, 130],
      size: [270, 130],
      order: 20,
      inputs: [
        input("samples", "LATENT", 40),
        input("width", "INT", 70, "width"),
        input("height", "INT", 71, "height"),
      ],
      outputs: [output("LATENT", "LATENT", 425, 0)],
      properties: coreProperties("LatentUpscale"),
      widgets_values: [
        stringInput(workflow, "425", "upscale_method", "bilinear"),
        dimensions.upscalePortraitWidth,
        dimensions.upscalePortraitHeight,
        stringInput(workflow, "425", "crop", "disabled"),
      ],
    }),
    createNode({
      id: 407,
      type: "EmptyLatentImage",
      pos: [100, 358],
      size: [270, 106],
      order: 18,
      inputs: [
        input("width", "INT", 56, "width"),
        input("height", "INT", 61, "height"),
      ],
      outputs: [output("LATENT", "LATENT", 407, 0)],
      properties: coreProperties("EmptyLatentImage"),
      widgets_values: [dimensions.portraitWidth, dimensions.portraitHeight, batchSize],
    }),
    createNode({
      id: 527,
      type: "easy ifElse",
      pos: [-391.5293750032889, 423.5139665619407],
      size: [270, 78],
      order: 10,
      inputs: [
        input("on_true", "*", 55),
        input("on_false", "*", 57),
        input("boolean", "BOOLEAN", 58, "boolean"),
      ],
      outputs: [output("*", "*", 527, 0)],
      title: "width",
      properties: easyUseProperties(),
      widgets_values: [false],
    }),
    createNode({
      id: 532,
      type: "easy ifElse",
      pos: [-454.2812873094525, 737.552014318068],
      size: [270, 78],
      order: 11,
      inputs: [
        input("on_true", "*", 64),
        input("on_false", "*", 65),
        input("boolean", "BOOLEAN", 72, "boolean"),
      ],
      outputs: [output("*", "*", 532, 0)],
      title: "width",
      properties: easyUseProperties(),
      widgets_values: [false],
    }),
    createNode({
      id: 528,
      type: "PrimitiveInt",
      pos: [-829.1104204507759, 727.2151709150243],
      size: [270, 82],
      order: 3,
      inputs: [],
      outputs: [output("INT", "INT", 528, 0)],
      properties: coreProperties("PrimitiveInt"),
      widgets_values: [dimensions.portraitHeight, "fixed"],
    }),
    createNode({
      id: 526,
      type: "PrimitiveInt",
      pos: [-828.0939333714026, 423.8654727430608],
      size: [270, 82],
      order: 4,
      inputs: [],
      outputs: [output("INT", "INT", 526, 0)],
      properties: coreProperties("PrimitiveInt"),
      widgets_values: [dimensions.portraitWidth, "fixed"],
    }),
    createNode({
      id: 533,
      type: "PrimitiveInt",
      pos: [1550.1214533616362, 582.5656705944002],
      size: [270, 82],
      order: 5,
      inputs: [],
      outputs: [output("INT", "INT", 533, 0)],
      properties: coreProperties("PrimitiveInt"),
      widgets_values: [dimensions.upscalePortraitWidth, "fixed"],
    }),
    createNode({
      id: 535,
      type: "PrimitiveInt",
      pos: [1549.104966282263, 885.9153687663638],
      size: [270, 82],
      order: 6,
      inputs: [],
      outputs: [output("INT", "INT", 535, 0)],
      properties: coreProperties("PrimitiveInt"),
      widgets_values: [dimensions.upscalePortraitHeight, "fixed"],
    }),
    createNode({
      id: 536,
      type: "easy ifElse",
      pos: [1923.9340994235863, 896.2522121694075],
      size: [270, 78],
      order: 13,
      inputs: [
        input("on_true", "*", 68),
        input("on_false", "*", 69),
        input("boolean", "BOOLEAN", 74, "boolean"),
      ],
      outputs: [output("*", "*", 536, 0)],
      title: "width",
      properties: easyUseProperties(),
      widgets_values: [false],
    }),
    createNode({
      id: 529,
      type: "PrimitiveBoolean",
      pos: [-762.7318650101703, 103.32071045449531],
      size: [270, 58],
      order: 7,
      inputs: [],
      outputs: [output("BOOLEAN", "BOOLEAN", 529, 0)],
      title: "vertical",
      properties: coreProperties("PrimitiveBoolean"),
      widgets_values: [dimensions.vertical],
    }),
    createNode({
      id: 534,
      type: "easy ifElse",
      pos: [1922.967150090922, 584.9255690224747],
      size: [270, 78],
      order: 12,
      inputs: [
        input("on_true", "*", 66),
        input("on_false", "*", 67),
        input("boolean", "BOOLEAN", 73, "boolean"),
      ],
      outputs: [output("*", "*", 534, 0)],
      title: "width",
      properties: easyUseProperties(),
      widgets_values: [false],
    }),
  ];

  return {
    id: "00000000-0000-0000-0000-000000000000",
    revision: 0,
    last_node_id: 536,
    last_link_id: 74,
    nodes,
    links: DEBUG_LINKS,
    groups: [],
    config: {},
    extra: {
      ue_links: [],
      links_added_by_ue: [],
      ds: {
        scale: 0.8639555983583508,
        offset: [1380.0572947737564, 76.59867886648982],
      },
      frontendVersion: "1.43.18",
      VHS_latentpreview: false,
      VHS_latentpreviewrate: 0,
      VHS_MetadataImage: true,
      VHS_KeepIntermediate: true,
    },
    version: 0.4,
  };
}

export function buildDebugWorkflowPrompt(workflow: Record<string, unknown>): Record<string, unknown> {
  return buildDebugGraphWorkflow(cloneJsonRecord(workflow)) as unknown as Record<string, unknown>;
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
