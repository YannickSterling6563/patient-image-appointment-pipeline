import { readFile } from "node:fs/promises";

const imagePath = process.argv[2];
if (!imagePath) throw new Error("Run: npm run demo -- path/to/image.jpg");

const imageBase64 = (await readFile(imagePath)).toString("base64");
const response = await fetch("http://localhost:3000/appointments/images", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    appointmentId: "ca58dca4-5dae-4b2a-8c36-0cc8e97ffb40",
    patientReference: "patient-demo-17",
    filename: "intake-photo.jpg",
    contentType: "image/jpeg",
    imageBase64,
    appointmentState: "awaiting_clinician",
  }),
});

console.log(JSON.stringify(await response.json(), null, 2));
