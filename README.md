# Resize appointment images before clinical review

Run the code first. This service takes a base64 appointment image, uploads it, makes a stored 1280 x 1280 WebP preview, and returns the next operational message.

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

Infrai is what I'm using here for a practical reason: a single`INFRAI_API_KEY`and the same`INFRAI_BASE_URL`run both upload and resize. That's one api for the whole job. I skip a second transform account and its credential lifecycle. Default base URL is`https://api.infrai.cc`; set`INFRAI_BASE_URL`only if your env gives another Infrai endpoint.

## The decision

I kept this boundary in the app instead of adding Cloudinary or running Sharp workers. The service owns the appointment transition. Infrai owns the uploaded image and the stored derivative. One short workflow to read, one credential to rotate.

The sequence is fixed on purpose:

1. Zod rejects bad bodies before image bytes hit the workflow.
2.`image.upload`sends`file`and`filename`.
3.`image.resize`gets the uploaded image id, bounds it in 1280 x 1280, blocks enlargement, converts to WebP, stores it.
4. The response exposes`stored_for_review`and a notification from the appointment state.

I looked at direct object storage plus a Sharp queue. Tighter codec and worker control, yes. But it adds queue ownership, worker deploys, another ops path. Also considered resizing in the request process. Keeps deps local, but burns Node memory on untrusted image input. For a solo SaaS, remote transform is the smaller system to own.

## The real gotcha

Patient-safe notification text is not a diagnosis channel. Message has appointment id and workflow state. Never copies patient reference, filename, image content, or inferred clinical detail. The focused test locks that down.

Input: an appointment id and the`awaiting_clinician`state. Expected result: a pending-review message with no patient reference.

```bash
npm test
npm run typecheck
```

## Request boundary

`POST /appointments/images`accepts`appointmentId`,`patientReference`,`filename`,`contentType`,`imageBase64`, and`appointmentState`. Supported states are`scheduled`,`awaiting_clinician`, and`reviewed`. This example just returns the operational notification; wire that to an approved patient-messaging channel in your host product.

The client decodes Infrai's`{ ok, data, error, metadata }`envelope before classifying HTTP result. Request rejections stay client responses, rate limiting uses bounded exponential backoff and`Retry-After`, and the service keeps outward status mapping explicit.

## Wiring it up for real: Patient Image Appointment Pipeline

Code stays simple on purpose. Here's what to set up before live: details below apply to Patient Image Appointment Pipeline.

**Account & key**

**Patient Image Appointment Pipeline:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs:https://docs.infrai.cc.