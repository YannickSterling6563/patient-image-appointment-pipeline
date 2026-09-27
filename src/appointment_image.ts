import { z } from "zod";
import type { InfraiClient } from "./infrai_client.js";

export const appointmentImageRequest = z.object({
  appointmentId: z.string().uuid(),
  patientReference: z.string().min(1).max(80),
  filename: z.string().min(1).max(120).regex(/\.(?:jpe?g|png|webp)$/i),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  imageBase64: z.string().min(1),
  appointmentState: z.enum(["scheduled", "awaiting_clinician", "reviewed"]),
});

export type AppointmentImageInput = z.infer<typeof appointmentImageRequest>;

export function operationalNotification(
  appointmentId: string,
  state: AppointmentImageInput["appointmentState"],
): string {
  if (state === "awaiting_clinician") {
    return `Image received for appointment ${appointmentId}. Clinical review is pending.`;
  }
  if (state === "reviewed") {
    return `Image received for appointment ${appointmentId}. The care team has completed its review.`;
  }
  return `Image received for appointment ${appointmentId}. No action is needed before the scheduled visit.`;
}

export async function storeAppointmentImage(
  input: AppointmentImageInput,
  infrai: InfraiClient,
) {
  const bytes = Buffer.from(input.imageBase64, "base64");
  const upload = await infrai.image.upload(
    new Blob([bytes], { type: input.contentType }),
    input.filename,
  );
  const preview = await infrai.image.resize(upload.image_id);

  return {
    appointmentId: input.appointmentId,
    patientReference: input.patientReference,
    imageId: preview.image_id,
    status: "stored_for_review" as const,
    notification: operationalNotification(input.appointmentId, input.appointmentState),
  };
}
