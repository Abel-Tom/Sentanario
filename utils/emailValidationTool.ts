import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ABSTRACT_EMAIL_API_KEY } from "../contants";

const ABSTRACT_EMAIL_REPUTATION_API_URL =
  "https://emailreputation.abstractapi.com/v1/";

export interface EmailValidationResult {
    email_address: string;
    isValid: boolean;
    status: string;
    status_detail: string;
    is_format_valid: boolean;
    is_username_suspicious: boolean;
    is_disposable: boolean;
    first_name: string | null;
    last_name: string | null;
    email_provider_name: string | null;
}
export interface EmailReputationResult {
  email_address: string;
  suggested_correction: string | null;

  email_deliverability: {
    status: string;
    status_detail: string;
    is_format_valid: boolean;
    is_smtp_valid: boolean;
    is_mx_valid: boolean;
    mx_records: string[];
  };

  email_sender: {
    first_name: string | null;
    last_name: string | null;
    email_provider_name: string | null;
    organization_name: string | null;
    organization_type: string | null;
  };

  email_domain: {
    domain: string;
    domain_age: number | null;
    is_live_site: boolean | null;
    registrar: string | null;
    registrar_url: string | null;
    date_registered: string | null;
    date_last_renewed: string | null;
    date_expires: string | null;
    is_risky_tld: boolean | null;
  };

  email_quality: {
    score: number;
    is_free_email: boolean;
    is_username_suspicious: boolean;
    is_disposable: boolean;
    is_catchall: boolean | null;
    is_subaddress: boolean;
    is_role: boolean;
    is_dmarc_enforced: boolean;
    is_spf_strict: boolean;
    minimum_age: number | null;
  };

  email_risk: {
    address_risk_status: string;
    domain_risk_status: string;
  };

  email_breaches: {
    total_breaches: number;
    date_first_breached: string | null;
    date_last_breached: string | null;
    breached_domains: string[];
  };
}


/**
 * Check the reputation and validity of an email address.
 *
 * This function is independent of LangChain so it can be tested directly.
 */
export async function validateEmail(
  email: string,
  apiKey: string | undefined = ABSTRACT_EMAIL_API_KEY
): Promise<EmailValidationResult> {
  if (!email || !email.trim()) {
    throw new Error("Email address is required");
  }

  if (!apiKey) {
    throw new Error("Abstract Email Reputation API key is not configured");
  }

  const url = new URL(ABSTRACT_EMAIL_REPUTATION_API_URL);

  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("email", email.trim());

  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorBody = await response.text();

    throw new Error(
      `Abstract Email Reputation API request failed: ` +
      `${response.status} ${response.statusText}. ${errorBody}`
    );
  }

  const data: EmailReputationResult = await response.json();

  const dataTool: EmailValidationResult = {
    email_address: data.email_address,
    isValid: data.email_deliverability.is_format_valid,
    status: data.email_deliverability.status,
    status_detail: data.email_deliverability.status_detail,
    is_format_valid: data.email_deliverability.is_format_valid,
    is_username_suspicious: data.email_quality.is_username_suspicious,
    is_disposable: data.email_quality.is_disposable,
    first_name: data.email_sender.first_name,
    last_name: data.email_sender.last_name,
    email_provider_name: data.email_sender.email_provider_name,
  };

  return dataTool;
}


/**
 * LangChain tool.
 */
export const emailValidationTool = new DynamicStructuredTool({
  name: "validate_email",

  description:
     "Validate an email address and check its deliverability, " +
    "format, suspicious username status, disposable status, " +
    "sender information, and email provider. " +
    "Use this tool whenever the user asks you to validate, " +
    "verify, or check an email address.",

  schema: z.object({
    email: z
      .string()
      .email()
      .describe("The email address to check"),
  }),

  func: async ({ email }) => {
    try {
      const result = await validateEmail(email);

      return JSON.stringify(result);
    } catch (error) {
      return JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to validate email address",
      });
    }
  },
});

// validateEmail("test@example.com").then((result) => {
//   console.log("Email validation result:", result);
// });