import mongoose from "mongoose";
import Dataset from "../modules/datasets/dataset.model.js";
export const newDataset = async (req, res, next) => {
  try {
    console.log("Here is the body:", req.body);
    const {description, name, price } = req.body;
    if (!req.body) {
      return res.status(401).json({ error: "Content required inside body" });
    }
    const datasetLabeler = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(datasetLabeler)) {
      return res.status(400).json({
        error:
          "datasetLabeler must be a valid user id (ObjectId). Provide a valid id or ensure auth sets req.user.",
      });
    }
    const dataset = await Dataset.create({
      datasetLabeler,
      description,
      name,
      price
    });
    req.datasetVersion = dataset.version;
    req.datasetId = dataset._id;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: `an error occurred in upload middleawre ${err.message}` });
  }
};
