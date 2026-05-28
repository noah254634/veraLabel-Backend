import { ALLOWED_CONTENT_TYPES, inferContentTypeFromDomain } from "../datasets/labellingProtocol.js";

const CONTENT_TYPES = new Set(ALLOWED_CONTENT_TYPES);
const LEGACY_RLHF_TYPES = new Set(["rfhlearning", "rlhf", "rflhf"]);

/** Normalize modality for a task (what the data is — not how it is labelled). */
export const normalizeContentType = (task = {}, dataset = null) => {
  const explicit = String(task.contentType || "").trim().toLowerCase();
  if (CONTENT_TYPES.has(explicit)) return explicit;

  const rawType = String(task.taskType || task.type || "").trim().toLowerCase();
  if (CONTENT_TYPES.has(rawType)) return rawType;

  if (LEGACY_RLHF_TYPES.has(rawType)) {
    return String(dataset?.contentType || "text").toLowerCase();
  }

  const mime = String(task.mimeType || task.contentType || "").toLowerCase();
  if (mime.startsWith("text/") || mime.includes("json")) return "text";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";

  if (dataset?.contentType && CONTENT_TYPES.has(String(dataset.contentType).toLowerCase())) {
    return String(dataset.contentType).toLowerCase();
  }
  if (dataset?.domain) {
    const fromDomain = inferContentTypeFromDomain(dataset.domain);
    if (CONTENT_TYPES.has(fromDomain)) return fromDomain;
  }

  return "text";
};

export const isLegacyRlhfTaskType = (value) =>
  LEGACY_RLHF_TYPES.has(String(value || "").trim().toLowerCase());
