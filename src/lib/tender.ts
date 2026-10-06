export interface Tender {
  tender_id: string;
  title: string;
  procuring_entity: string;
  bidder: string;
  submission_deadline: string; // YYYY-MM-DD
}

export interface Requirement {
  id: string;
  order: number;
  title_en: string;
  title_bn: string;
  mandatory: boolean;
  has_expiry: boolean;
}

export interface RequirementsFile {
  tender: Tender;
  requirements: Requirement[];
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  pages: number | null; // null while counting
  bytes: ArrayBuffer;
  hash: string;
  error?: string; // damaged / protected pdf
}

export type DocStatus =
  | "missing"
  | "expiry_needed"
  | "expired"
  | "not_provided"
  | "ok";

export function computeStatus(
  req: Requirement,
  file: UploadedFile | undefined,
  expiryDate: string | undefined,
  deadline: string
): DocStatus {
  if (!file) return req.mandatory ? "missing" : "not_provided";
  if (req.has_expiry) {
    if (!expiryDate) return "expiry_needed";
    if (expiryDate < deadline) return "expired";
  }
  return "ok";
}

export function isBlocking(status: DocStatus): boolean {
  return status === "missing" || status === "expiry_needed" || status === "expired";
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
