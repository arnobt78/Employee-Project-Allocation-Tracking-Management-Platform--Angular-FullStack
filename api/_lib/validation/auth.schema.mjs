import { z } from "zod";

/** Shared login body — keep in sync with src/app/lib/validation/auth.schema.ts */
export const loginCredentialsSchema = z.object({
  username: z
    .string({ required_error: "Username is required" })
    .trim()
    .min(1, "Username is required")
    .max(128, "Username is too long"),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required")
    .max(256, "Password is too long"),
});

/**
 * @param {unknown} input
 * @returns {{ success: true, data: { username: string, password: string } } | { success: false, message: string }}
 */
export function parseLoginCredentials(input) {
  const result = loginCredentialsSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const message =
    result.error.issues[0]?.message ?? "Username and password are required";
  return { success: false, message };
}
