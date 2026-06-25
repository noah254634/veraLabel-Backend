import express from "express";
const router=express.Router();
import { protectRoute } from "../../middlewares/auth.middleware.js";
import { attachBuyer } from "../buyer/buyer.middleware.js";
import { Upload } from "./datasets.multer.js";
import { prepareDatasetVersion } from "../../middlewares/version.middleware.js";
import {datasetController} from "./dataset.controller.js";
router.use(protectRoute)
router.post("/createDataset", attachBuyer, datasetController.createDataset);

router.get("/allDatasets", datasetController.getAllDatasets);
router.post("/confirmUpload",datasetController.confirmUpload)
// Optional: filter datasets by type or status
router.get("/filter", datasetController.filterDatasets);
router.post("/generateUploadUrl",datasetController.generateUploadUrl);
router.get("/buyerSideDatasets",protectRoute,datasetController.buyerSideDatasets);

router.get("/:id/download", datasetController.downloadDataset);

router.get("/:id", datasetController.getDatasetById);

router.put(
  "/updateDataset/:id",
  prepareDatasetVersion,
  Upload().single("datasetFile"),
  datasetController.updateDataset
);

// Delete a dataset by ID
router.delete("/deleteDataset/:id", datasetController.deleteDataset);

export default router;
