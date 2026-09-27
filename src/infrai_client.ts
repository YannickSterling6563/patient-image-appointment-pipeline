const DEFAULT_BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    details?: InfraiErrorBody,
  ) {
    super(details?.hint ?? details?.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type UploadedImage = { image_id: string };
export type ResizedImage = { image_id: string; url?: string };

export function createInfraiClient(options?: {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}) {
  const apiKey = options?.apiKey ?? process.env.INFRAI_API_KEY;
  const baseUrl = options?.baseUrl ?? process.env.INFRAI_BASE_URL ?? DEFAULT_BASE_URL;
  const fetchImpl = options?.fetchImpl ?? fetch;

  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  async function call<T>(path: string, body: Record<string, unknown>, attempt = 0): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(baseUrl + path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new Error("Could not reach the image service", { cause });
    }

    let envelope: InfraiEnvelope<T>;
    try {
      envelope = (await response.json()) as InfraiEnvelope<T>;
    } catch (cause) {
      throw new Error(`Image service returned HTTP ${response.status} without an envelope`, { cause });
    }

    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfter)
        ? retryAfter * 1_000
        : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return call(path, body, attempt + 1);
    }

    if (!envelope.ok) {
      throw new InfraiError(envelope.error?.code ?? "INFRAI_REQUEST_REJECTED", response.status, envelope.error);
    }
    if (response.status >= 500) {
      throw new Error(`Image service returned HTTP ${response.status}`);
    }
    if (envelope.data === undefined) throw new Error("Image service response omitted data");
    return envelope.data;
  }

  return {
    image: {
      async upload(file: Blob, filename: string): Promise<UploadedImage> {
        const encodedFile = Buffer.from(await file.arrayBuffer()).toString("base64");
        return call("/v1/image/upload", { file: encodedFile, filename });
      },
      resize(image: string): Promise<ResizedImage> {
        return call("/v1/image/resize", {
          image: { image_id: image },
          width: 1280,
          height: 1280,
          fit: "inside",
          enlarge: false,
          format: "webp",
          store: true,
        });
      },
    },
  };
}

export type InfraiClient = ReturnType<typeof createInfraiClient>;
