/** Protocol ↔ labellingMethod compatibility (submission-time validation). */

export const ALLOWED_LABELLING_METHODS = ["rlhf", "classification", "annotation", "transcription"];

export const ALLOWED_CONTENT_TYPES = ["text", "audio", "video", "image", "code", "document"];

export const isRlhfProtocol = (template) => {
  if (!template) return false;
  const sc = template.scoringConfig || {};
  const taskTypes = sc.taskTypes || [];
  return taskTypes.length > 0 || Boolean(sc.requireRationale);
};

export const protocolMatchesLabellingMethod = (template, labellingMethod) => {
  const method = String(labellingMethod || "").trim().toLowerCase();
  const isRlhf = isRlhfProtocol(template);
  if (method === "rlhf") return isRlhf;
  return !isRlhf;
};

export const assertProtocolMatchesMethod = (template, labellingMethod) => {
  const method = String(labellingMethod || "").trim().toLowerCase();
  if (!ALLOWED_LABELLING_METHODS.includes(method)) {
    throw new Error(`Invalid labellingMethod: ${labellingMethod}`);
  }
  if (!template) {
    throw new Error("Protocol not found");
  }
  const isRlhf = isRlhfProtocol(template);
  if (method === "rlhf" && !isRlhf) {
    throw new Error(
      "Selected protocol does not support RLHF. Choose a protocol with preference ranking or dimensional scoring."
    );
  }
  if (method !== "rlhf" && isRlhf) {
    throw new Error(
      "Selected protocol is RLHF-only. Change labelling method to RLHF or pick a non-RLHF protocol."
    );
  }
};

export const inferContentTypeFromDomain = (domain) => {
  const raw = String(domain || "").trim();
  const map = {
    NLP: "text",
    Code: "code",
    Legal: "document",
    Audio: "audio",
    Tabular: "text",
    Medical: "image",
  };
  return map[raw] || "text";
};

export const inferContentTypeFromFileName = (fileName) => {
  const ext = String(fileName || "").split(".").pop()?.toLowerCase() || "";
  if (["mp3", "wav", "flac", "ogg", "m4a", "aac"].includes(ext)) return "audio";
  if (["mp4", "webm", "mov", "mkv"].includes(ext)) return "video";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "dcm", "dicom"].includes(ext)) return "image";
  if (["pdf", "docx", "doc"].includes(ext)) return "document";
  if (["py", "js", "ts", "java", "go", "rs", "cpp", "c", "rb"].includes(ext)) return "code";
  if (["json", "jsonl", "csv", "txt", "xml", "parquet"].includes(ext)) return "text";
  return null;
};

export const fileMatchesContentType = (fileName, contentType) => {
  const inferred = inferContentTypeFromFileName(fileName);
  if (!inferred) return true;
  const ct = String(contentType || "").toLowerCase();
  if (ct === inferred) return true;
  if (ct === "text" && ["code", "document"].includes(inferred)) return true;
  if (ct === "code" && inferred === "text") return true;
  if (ct === "document" && inferred === "text") return true;
  
  return false;
};
