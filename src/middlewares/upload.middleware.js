import mongoose from "mongoose";
import Dataset from "../modules/datasets/dataset.model.js";
import logger from "../config/logger.js";

export const newDataset = async (req, res, next) => {
  try {
    const { description, name, price } = req.body;
    if (!description || !name || !price) {
      return res.status(400).json({ error: "description, name, and price are required" });
    }
    const datasetLabeler = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(datasetLabeler)) {
      return res.status(400).json({
        error: "datasetLabeler must be a valid user id (ObjectId). Provide a valid id or ensure auth sets req.user.",
      });
    }
    const dataset = await Dataset.create({
      datasetLabeler,
      description,
      name,
      price,
    });
    req.datasetVersion = dataset.version;
    req.datasetId = dataset._id;
    next();
  } catch (err) {
    logger.error("Upload middleware error", { message: err.message });
    return res.status(500).json({ error: "An internal error occurred. Please try again." });
  }
};
