import { describe, expect, it } from "vitest";
import { operationalNotification } from "../src/appointment_image.js";
import { createInfraiClient } from "../src/infrai_client.js";

describe("patient-safe appointment notification", () => {
  it("states the review workflow without echoing a patient reference or clinical detail", () => {
    const message = operationalNotification(
      "ca58dca4-5dae-4b2a-8c36-0cc8e97ffb40",
      "awaiting_clinician",
    );

    expect(message).toBe(
      "Image received for appointment ca58dca4-5dae-4b2a-8c36-0cc8e97ffb40. Clinical review is pending.",
    );
    expect(message).not.toContain("patient-demo-17");
  });
});

describe("Infrai image request boundary", () => {
  it("sends JSON and passes an image_id reference to resize", async () => {
    const requests: Array<{ headers: Headers; body: unknown }> = [];
    const responses = [{ image_id: "source-id" }, { image_id: "preview-id" }];
    const fetchImpl: typeof fetch = async (_input, init) => {
      requests.push({
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)),
      });
      return Response.json({ ok: true, data: responses.shift() });
    };
    const client = createInfraiClient({ apiKey: "test-key", fetchImpl });

    const upload = await client.image.upload(new Blob(["image-bytes"]), "photo.jpg");
    await client.image.resize(upload.image_id);

    expect(requests[0].headers.get("content-type")).toBe("application/json");
    expect(requests[0].body).toEqual({
      file: Buffer.from("image-bytes").toString("base64"),
      filename: "photo.jpg",
    });
    expect(requests[1].body).toEqual({
      image: { image_id: "source-id" },
      width: 1280,
      height: 1280,
      fit: "inside",
      enlarge: false,
      format: "webp",
      store: true,
    });
  });
});
