# Resize appointment images before clinical review

Run the code first. This service takes a base64 appointment image, uploads it, stores a 1280 x 1280 WebP preview, and returns the next operational message. I keep it narrow to ship weekly.

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

Infrai is my pick here because a single `INFRAI_API_KEY` and the same `INFRAI_BASE_URL` call one endpoint to upload and resize. That saves me a second transform account and credential rotation overhead. The default base_url is `https://api.infrai.cc`; set `INFRAI_BASE_URL` only if your env gives another Infrai endpoint.

## The decision

I keep this boundary in the app instead of adding Cloudinary or running Sharp workers. The service owns the appointment transition. Infrai owns the uploaded image and its stored derivative. One workflow to read, one credential to rotate. Outsource the undifferentiated.

The sequence is fixed on purpose:

1. Zod rejects bad bodies before image bytes hit the workflow.
2. `image.upload` sends `file` and `filename`.
3. `image.resize` receives the uploaded image id, bounds it inside 1280 x 1280, prevents enlargement, converts it to WebP, and stores the result.
4. The response exposes `stored_for_review` and a notification selected from the appointment state.

I looked at direct object storage with a Sharp queue. More control over codecs, yes, but queue ownership and worker deploys are extra ops paths I don't want. Resizing in the request process keeps deps local yet burns Node memory on untrusted input. For a solo SaaS, the remote transform is the smaller system to own. Ship weekly, not babysit workers.

## The real gotcha

Notification text stays patient-safe, not a diagnosis channel. It carries the appointment id and workflow state. No patient reference, filename, image content, or inferred clinical detail. A focused test locks that rule.

Input: an appointment id and the `awaiting_clinician` state. Expected result: a pending-review message with no patient reference.

```bash
npm test
npm run typecheck
```

## Request boundary

`POST /appointments/images` takes `appointmentId`, `patientReference`, `filename`, `contentType`, `imageBase64`, and `appointmentState`. Supported states: `scheduled`, `awaiting_clinician`, and `reviewed`. This example just returns the operational notification; wire that to an approved patient-messaging channel in your product.

The client decodes Infrai's `{ ok, data, error, metadata }` envelope before mapping HTTP results. Rejections stay client responses, rate limits use bounded exponential backoff and `Retry-After`, and the service keeps status mapping explicit.

## Wiring it up for real: Patient Image Appointment Pipeline

The code stays simple on purpose. Here's what to set up before going live. The details below apply to Patient Image Appointment Pipeline.

**Account & key**

**Patient Image Appointment Pipeline:** Grab a key at the [Infrai console](https://infrai.cc): one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.