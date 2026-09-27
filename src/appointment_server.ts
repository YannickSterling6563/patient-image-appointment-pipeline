import express from "express";
import { ZodError } from "zod";
import { appointmentImageRequest, storeAppointmentImage } from "./appointment_image.js";
import { createInfraiClient, InfraiError } from "./infrai_client.js";

const app = express();
const infrai = createInfraiClient();

app.use(express.json({ limit: "12mb" }));

app.post("/appointments/images", async (request, response) => {
  try {
    const input = appointmentImageRequest.parse(request.body);
    response.status(201).json(await storeAppointmentImage(input, infrai));
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: "invalid_request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      response.status(error.status).json({ error: error.code, message: error.message });
      return;
    }
    console.error(error);
    response.status(502).json({ error: "image_processing_unavailable" });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Appointment image service listening on http://localhost:${port}`));
