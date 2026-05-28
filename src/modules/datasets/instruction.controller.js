import { InstructionTemplate } from "./instruction.model.js";
import logger from "../../config/logger.js";
import { asyncHandler, AppError } from "../../middlewares/errorHandler.middleware.js";
import ResponseHandler from "../../helpers/responseHandler.js";
import { protocolMatchesLabellingMethod } from "./labellingProtocol.js";

export const instructionController = {
  createTemplate: asyncHandler(async (req, res) => {
    const { name, domains, buyerVisibleSummary } = req.body;
    const adminId = req.user?._id;

    if (!name || !domains || !buyerVisibleSummary)
      throw new AppError("Name, domains, and buyerVisibleSummary are required", 400);

    const existing = await InstructionTemplate.findOne({ name });
    if (existing) throw new AppError("A template with this name already exists", 400);

    const template = await InstructionTemplate.create({
      ...req.body,
      createdBy: adminId,
    });

    logger.info(`Instruction Template created: ${template.name} by ${adminId}`);
    return ResponseHandler.created(res, { template }, "Template created successfully");
  }),

  getTemplates: asyncHandler(async (req, res) => {
    const { domain, labellingMethod, includeDrafts } = req.query;
    const filter = {};
    if (includeDrafts === "true") {
      filter.status = { $in: ["published", "draft"] };
    } else {
      filter.status = "published";
    }
    if (domain) filter.domains = { $in: [domain] };
    let templates = await InstructionTemplate.find(filter).sort({ createdAt: -1 });
    if (labellingMethod) {
      const method = String(labellingMethod).trim().toLowerCase();
      templates = templates.filter((t) => protocolMatchesLabellingMethod(t, method));
    }
    return ResponseHandler.success(res, { templates }, "Templates fetched");
  }),

  getByDataset: asyncHandler(async (req, res) => {
    const { datasetId } = req.params;
    const Dataset = (await import("../datasets/dataset.model.js")).default;

    const dataset = await Dataset.findById(datasetId).populate({
      path: "instructionId",
      model: "DatasetInstruction",
      populate: { path: "templateId", model: "InstructionTemplate" },
    });

    if (!dataset) throw new AppError("Dataset not found", 404);
    if (!dataset.instructionId) throw new AppError("No instruction protocol attached to this dataset", 404);

    return ResponseHandler.success(res, dataset.instructionId, "Instruction fetched");
  }),

  updateTemplate: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const existing = await InstructionTemplate.findById(id);
    if (existing) {
      const parts = existing.version.split(".");
      parts[2] = parseInt(parts[2]) + 1;
      updates.version = parts.join(".");
    }

    const template = await InstructionTemplate.findByIdAndUpdate(id, updates, { new: true });
    if (!template) throw new AppError("Template not found", 404);

    return ResponseHandler.success(res, { template }, "Template updated");
  }),

  deleteTemplate: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const template = await InstructionTemplate.findByIdAndUpdate(id, { status: "archived" }, { new: true });
    if (!template) throw new AppError("Template not found", 404);
    return ResponseHandler.success(res, null, "Template disabled successfully");
  }),
};
