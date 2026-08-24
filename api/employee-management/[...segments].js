import { handleEmployeeManagementRequest } from "./handler.mjs";
import { captureApiException } from "../_lib/sentry/server.mjs";

export default async function handler(req, res) {
  try {
    return await handleEmployeeManagementRequest(req, res);
  } catch (error) {
    console.error("[Vercel Handler] Error:", error);
    captureApiException(error, { surface: "vercel-segments" });

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "Internal server error",
          message: error.message,
          url: req.url,
        })
      );
    }
  }
}
