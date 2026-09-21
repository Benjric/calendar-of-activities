import { z } from "zod";

/**
 * One schema validating both the client form and the server action.
 *
 * Server Functions are reachable by direct POST, not only through the UI, so the
 * server re-validates everything regardless of what the client checked.
 */

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

/** Blank optional fields arrive as "" from FormData; treat them as absent. */
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const optionalDecimal = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional()
  .refine((v) => v === undefined || !Number.isNaN(Number(v)), "Must be a number")
  .refine((v) => v === undefined || Number(v) >= 0, "Cannot be negative");

export const bookingSchema = z
  .object({
    title: z.string().trim().min(3, "Give the activity a title"),

    /**
     * Programs, like venues, are typed rather than selected. An unrecognised
     * name is created on save and becomes a suggestion for the next booking.
     */
    programName: optionalText,

    startDate: dateString,
    endDate: dateString,

    /**
     * Venues are typed, not selected. An unrecognised name is created on save
     * and becomes a suggestion for the next booking.
     */
    venueName: optionalText,
    leadDivisionId: optionalText,
    focalPersonId: optionalText,
    participantIds: z.array(z.string()).default([]),

    type: z.enum(["LND", "NON_LND"]),
    performanceIndicator: optionalText,
    hasFinancialReq: z.boolean().default(false),
    sourceOfFund: z.enum(["MOOE", "HRTD", "PSF", "OTHER"]).optional(),
    sourceOfFundOther: optionalText,

    physicalTarget: optionalDecimal,
    financialTarget: optionalDecimal,

    /** Conflict kinds the user explicitly chose to proceed past. */
    acknowledgedConflicts: z.array(z.enum(["DATE", "VENUE", "PARTICIPANT"])).default([]),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "The end date cannot fall before the start date",
    path: ["endDate"],
  })
  .refine((v) => !v.hasFinancialReq || Boolean(v.sourceOfFund), {
    message: "Select a source of fund",
    path: ["sourceOfFund"],
  })
  .refine(
    (v) => v.sourceOfFund !== "OTHER" || Boolean(v.sourceOfFundOther),
    { message: "Name the other fund source", path: ["sourceOfFundOther"] },
  );

export type BookingInput = z.infer<typeof bookingSchema>;

/**
 * Conducted reporting.
 *
 * The narrative requirement is deliberately NOT encoded as "always required":
 * it depends on the sign of each variance, which only the server can compute
 * from the submitted numbers. `validateConductedNarratives` below does that.
 */
export const conductedSchema = z.object({
  activityId: z.string().min(1),
  physicalTarget: optionalDecimal,
  physicalAccomplishment: optionalDecimal,
  financialTarget: optionalDecimal,
  financialAccomplishment: optionalDecimal,
  physicalNotablePractice: optionalText,
  physicalJustification: optionalText,
  financialNotablePractice: optionalText,
  financialJustification: optionalText,
});

export const rescheduleSchema = z
  .object({
    activityId: z.string().min(1),
    reasonForPostponement: z.string().trim().min(5, "State the reason for postponement"),
    proposedStartDate: dateString,
    proposedEndDate: dateString,
    acknowledgedConflicts: z.array(z.enum(["DATE", "VENUE", "PARTICIPANT"])).default([]),
  })
  .refine((v) => v.proposedEndDate >= v.proposedStartDate, {
    message: "The end date cannot fall before the start date",
    path: ["proposedEndDate"],
  });

export const dropSchema = z.object({
  activityId: z.string().min(1),
  reasonForDropping: z.string().trim().min(5, "State the reason for dropping"),
});

/**
 * Accounts.
 *
 * Email is lower-cased here because `authorize` in `src/auth.ts` looks the
 * account up by the lower-cased address. Storing "A@x.gov.ph" would create an
 * account nobody could ever sign in to.
 */
const accountEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

const accountPassword = z
  .string()
  .min(8, "Use at least 8 characters");

export const roleEnum = z.enum(["ADMIN", "PROGRAM_MANAGER", "VIEWER"]);

export const createAccountSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's name"),
  email: accountEmail,
  password: accountPassword,
  role: roleEnum,
  divisionId: optionalText,
  personId: optionalText,
});

/** Password is absent here — resetting it is its own deliberate action. */
export const updateAccountSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2, "Enter the person's name"),
  email: accountEmail,
  role: roleEnum,
  divisionId: optionalText,
  personId: optionalText,
});

export const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: accountPassword,
});

export const setAccountActiveSchema = z.object({
  userId: z.string().min(1),
  isActive: z.boolean(),
});
