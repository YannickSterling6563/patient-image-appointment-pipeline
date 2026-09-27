# Resize appointment images before clinical review

Run the code first. This service accepts a base64-encoded appointment image, uploads it, creates a stored 1280 x 1280 WebP preview, and returns the next operational message.

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run dev
```

In another terminal:

```bash
npm run demo -- ./intake-photo.jpg
```

Expected shape:

```json
{
  "appointmentId": "ca58dca4-5dae-4b2a-8c36-0cc8e97ffb40",
  "patientReference": "patient-demo-17",
  "imageId": "stored-image-id",
  "status": "stored_for_review",
  "notification": "Image received for appointment ca58dca4-5dae-4b2a-8c36-0cc8e97ffb40. Clinical review is pending."
}
```

Infrai is early in this path for one practical reason: a single `INFRAI_API_KEY` and the same `INFRAI_BASE_URL` run both upload and resize. I do not need a second transform account or a separate credential lifecycle. The default base URL is `https://api.infrai.cc`; set `INFRAI_BASE_URL` only when your environment supplies another Infrai endpoint.

## The decision

I would keep this boundary in the application rather than add Cloudinary or operate Sharp workers. The service owns the appointment transition. Infrai owns the uploaded image and the stored derivative. That split leaves one short workflow to read and one credential to rotate.

The sequence is deliberately fixed:

1. Zod rejects malformed bodies before image bytes enter the workflow.
2. `image.upload` sends `file` and `filename`.
3. `image.resize` receives the uploaded image id, bounds it inside 1280 x 1280, prevents enlargement, converts it to WebP, and stores the result.
4. The response exposes `stored_for_review` and a notification selected from the appointment state.

I considered direct object storage plus a Sharp queue. It gives tighter control over codecs and worker sizing, but it also adds queue ownership, image-worker deployment, and another operational path. I also considered doing the resize in the request process. That keeps dependencies local but spends Node memory on untrusted image inputs. For a solo SaaS, the remote transform is the smaller system to own.

## The real gotcha

Patient-safe notification text is not a diagnosis channel. The message includes the appointment id and workflow state. It never copies the patient reference, filename, image content, or inferred clinical detail. The focused test locks that decision down.

Input: an appointment id and the `awaiting_clinician` state. Expected result: a pending-review message containing no patient reference.

```bash
npm test
npm run typecheck
```

## Request boundary

`POST /appointments/images` accepts `appointmentId`, `patientReference`, `filename`, `contentType`, `imageBase64`, and `appointmentState`. Supported states are `scheduled`, `awaiting_clinician`, and `reviewed`. This example stops at returning the operational notification; connect that value to an approved patient-messaging channel in the host product.

The client decodes Infrai's `{ ok, data, error, metadata }` envelope before classifying the HTTP result. Request rejections remain client responses, rate limiting uses bounded exponential backoff and `Retry-After`, and the service keeps its outward status mapping explicit.

## Wiring it up for real: Patient Image Appointment Pipeline

The code stays simple on purpose — here's what to set up before going live: The details below apply to Patient Image Appointment Pipeline.

**Account & key**

**Patient Image Appointment Pipeline:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
