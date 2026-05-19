import { InstructionTemplate } from "./instruction.model.js";
import logger from "../../config/logger.js";

export const instructionController = {
  createTemplate: async (req, res) => {
    try {
      const { 
        name, domains, languageRegion, labellerTier, buyerVisibleSummary, 
        baseDirectives, buyerQuestions, scoringConfig, rubrics, 
        goldenExamples, edgeCases, adjudicationPolicy, status 
      } = req.body;
      const adminId = req.user?._id;

      if (!name || !domains || !buyerVisibleSummary) {
        return res.status(400).json({ message: "Name, domains, and buyerVisibleSummary are required." });
      }

      const existing = await InstructionTemplate.findOne({ name });
      if (existing) {
        return res.status(400).json({ message: "A template with this name already exists." });
      }

      const template = await InstructionTemplate.create({
        name,
        domains,
        languageRegion,
        labellerTier,
        buyerVisibleSummary,
        baseDirectives: baseDirectives || [],
        buyerQuestions: buyerQuestions || [],
        scoringConfig: scoringConfig || {},
        rubrics: rubrics || [],
        goldenExamples: goldenExamples || [],
        edgeCases: edgeCases || [],
        adjudicationPolicy: adjudicationPolicy || {},
        status: status || 'draft',
        createdBy: adminId,
      });

      logger.info(`Instruction Template created: ${template.name} by ${adminId}`);
      return res.status(201).json(template);
    } catch (err) {
      logger.error(`Error creating instruction template: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },

  getTemplates: async (req, res) => {
    try {
      const { domain } = req.query;
      // Only show published templates to buyers
      const filter = { status: "published" };
      if (domain) filter.domains = { $in: [domain] };

      const templates = await InstructionTemplate.find(filter).sort({ createdAt: -1 });
      return res.status(200).json(templates);
    } catch (err) {
      logger.error(`Error fetching instruction templates: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },

  // Fetch the full instruction (populated from template) for a specific dataset
  getByDataset: async (req, res) => {
    try {
      const { datasetId } = req.params;
      const Dataset = (await import("../datasets/dataset.model.js")).default;

      const dataset = await Dataset.findById(datasetId)
        .populate({
          path: "instructionId",
          model: "DatasetInstruction",
          populate: { path: "templateId", model: "InstructionTemplate" }
        });

      if (!dataset) return res.status(404).json({ message: "Dataset not found." });

      // Return the DatasetInstruction if it exists, otherwise fallback to the raw template
      const instruction = dataset.instructionId;
      if (!instruction) return res.status(404).json({ message: "No instruction protocol attached to this dataset." });

      return res.status(200).json(instruction);
    } catch (err) {
      logger.error(`Error fetching dataset instruction: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },

  updateTemplate: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Auto-increment version logically
      const existing = await InstructionTemplate.findById(id);
      if (existing) {
        const parts = existing.version.split('.');
        parts[2] = parseInt(parts[2]) + 1;
        updates.version = parts.join('.');
      }

      const template = await InstructionTemplate.findByIdAndUpdate(id, updates, { new: true });
      if (!template) {
        return res.status(404).json({ message: "Template not found." });
      }

      return res.status(200).json(template);
    } catch (err) {
      logger.error(`Error updating instruction template: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  },

  deleteTemplate: async (req, res) => {
    try {
      const { id } = req.params;
      // Soft delete by setting isActive to false
      const template = await InstructionTemplate.findByIdAndUpdate(id, { isActive: false }, { new: true });
      if (!template) {
        return res.status(404).json({ message: "Template not found." });
      }

      return res.status(200).json({ message: "Template disabled successfully." });
    } catch (err) {
      logger.error(`Error deleting instruction template: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }
  }
};
