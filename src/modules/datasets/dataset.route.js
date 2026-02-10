import express from "express";
const router=express.Router();
import { protectRoute } from "../../middlewares/auth.middleware.js";
import { newDataset } from "../../middlewares/upload.middleware.js";
import { Upload } from "./datasets.multer.js";
import { prepareDatasetVersion } from "../../middlewares/version.middleware.js";
import {datasetController} from "./dataset.controller.js";
router.use(protectRoute)
// Create a new dataset
router.post(
  "/createDataset",
  newDataset,
  Upload().single("datasetFile"),
  datasetController.createDataset
);

// Get all datasets
router.get("/allDatasets", datasetController.getAllDatasets);

// Optional: filter datasets by type or status
router.get("/filter", datasetController.filterDatasets);

// Get a single dataset by ID
router.get("/:id", datasetController.getDatasetById);

// Update a dataset by ID
router.put(
  "/updateDataset/:id",
  prepareDatasetVersion,
  Upload().single("datasetFile"),
  datasetController.updateDataset
);

// Delete a dataset by ID
router.delete("/deleteDataset/:id", datasetController.deleteDataset);

export default router;
