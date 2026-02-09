import express from "express";
const router=express.Router();
import multer from "multer";
import upload from "./datasets.multer.js";
import datasetController from "../controllers/datasetController.js";
// Create a new dataset
router.post("/createDataset",upload.single("datasetFile"), datasetController.createDataset);

// Get all datasets
router.get("/allDatasets", datasetController.getAllDatasets);

// Get a single dataset by ID
router.get("/:id", datasetController.getDatasetById);

// Update a dataset by ID
router.put("/updateDataset/:id", datasetController.updateDataset);

// Delete a dataset by ID
router.delete("/deleteDataset/:id", datasetController.deleteDataset);

// Optional: filter datasets by type or status
router.get("/filter", datasetController.filterDatasets);


export default router;
