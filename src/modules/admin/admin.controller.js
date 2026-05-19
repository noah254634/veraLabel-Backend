import logger from "../../config/logger.js";
import { adminService } from "./admin.service.js";
export const adminController = {
  verifyUser: async (req, res) => {
    try {
      logger.info("Verifying user");
      const { id } = req.params;
      const user = await adminService.verifyUserById(id);
      return res.json(user);
    }catch(err){
      logger.error(`Error verifying user: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  unverifyUser: async (req, res) => {
    try {
      logger.info("Unverifying user");
      const { id } = req.params;
      const user = await adminService.unverifyUserById(id);
      return res.json(user);
    } catch (err) {
      logger.error(`Error unverifying user: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  deleteUser: async (req, res) => {
    logger.info("Deleting user");
    try {
      const { id } = req.params;
      const user = await adminService.deleteUserById(id);
      return res.json(user);
    } catch (err) {
      logger.error(`Error deleting user: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }


  },
  rateUser:async(req,res)=>{
    logger.info("Rating User")
    const {id}=req.params;
    const {rate}=req.body;
    const rating=parseInt(rate);
    const user=await adminService.rateUser(id,rating);
    return user
  },
  unpublishDataset: async (req, res) => {
    try {
      logger.info("Unpublishing dataset");
      const { id } = req.params;
      const dataset = await adminService.unpublishDatasetById(id);
      return res.json(dataset);
      } catch (err) {
      logger.error(`Error unpublishing dataset: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
publishDataset: async (req, res) => {
  try {
    logger.info("Publishing dataset");
    const { id } = req.params;
    logger.info(`Publishing dataset with id: ${id}`);
    const dataset = await adminService.publishDatasetById(id);
    return res.json(dataset);
  }catch (err) {
    logger.error(`Error publishing dataset: ${err.message}`);
    return res.status(400).json({ message: err.message });
  }
},
  updateDatasetPrice: async (req, res) => {
    try {
      logger.info("Updating dataset price");
      const { id } = req.params;
      const { price } = req.body;
      if (!price) throw new Error("Price not found");
      const newPrice = parseInt(price);
      const dataset = await adminService.updateDatasetPrice(id, newPrice);
      return res.json(dataset);
    } catch (err) {
      logger.error(`Error updating dataset price: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  updateDatasetBatchPrice: async (req, res) => {
    try {
      logger.info("Updating dataset batch price");
      const { id } = req.params;
      const { pricePerBatch } = req.body;
      if (pricePerBatch === undefined) throw new Error("Batch price not found");
      const dataset = await adminService.updateDatasetBatchPrice(id, parseFloat(pricePerBatch));
      return res.json(dataset);
    } catch (err) {
      logger.error(`Error updating batch price: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  pendingDatasets: async (req, res) => {
    try {
      logger.info("Fetching pending datasets");

      const datasets = await adminService.pendingDatasets();
      return res.json(datasets);
    } catch (err) {
      logger.error(`Error fetching pending datasets: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  approvedDatasets: async (req, res) => {
    try {
      logger.info("Fetching approved datasets");
      const datasets = await adminService.approvedDatasets();
      return res.json(datasets);
    } catch (err) {
      logger.error(`Error fetching approved datasets: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  rejectedDatasets: async (req, res) => {
    try {
      const datasets = await adminService.rejectedDatasets();
      return res.json(datasets);
    } catch (err) {
      logger.error(`Error fetching rejected datasets: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  flaggedDatasets: async (req, res) => {
    try {
      logger.info("Fetching flagged datasets");
      const datasets = await adminService.flaggedDatasets();
      return res.json(datasets);
    } catch (err) {
      logger.error(`Error fetching flagged datasets: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },

  banUser: async (req, res) => {
    try {
      logger.info("Banning user");
      const { id } = req.params;
      const { reason } = req.body;
      const user = await adminService.banUserById(id, reason);
      return res.json(user);
    } catch (err) {
      logger.error(`Error banning user: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  promoteToReviewer: async (req, res) => {
    try {
      logger.info("Promoting user to reviewer");
      const {reason}=req.body;
      logger.info(`Promoting user with id: ${req.params.id} to reviewer for reason: ${reason}`);
      const { id } = req.params;
      const user = await adminService.promoteToReviewerById(id);
      return res.json(user);
    } catch (err) {
      logger.error(`Error promoting user to reviewer: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },

  promoteUser: async (req, res) => {
    try {
      logger.info("Promoting user");
      const { id } = req.params;
      const user = await adminService.promoteUserById(id);
      return res.json({
        success: true,
        user,
        message: "User promoted successfully",
      });
    } catch (err) {
      logger.error(`Error promoting user: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  
  demoteUser: async (req, res) => {
    try {
      logger.info(`Demoting user with id: ${req.params.id}`);
      const { id } = req.params;
      const user = await adminService.demoteUserById(id);
      return res.json(user);
    } catch (err) {
      logger.error(`Error demoting user: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  blockUser: async (req, res) => {
    try {
      logger.info("Blocking user");
      const { id } = req.params;
      const { reason } = req.body;
      const user = await adminService.blockUserById(id, reason);
      return res.json(user);
    } catch (err) {
      logger.error(`Error blocking user: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  unblockUser: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await adminService.unblockUserById(id);
      return res.json(user);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
  suspendUser: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const user = await adminService.suspendUserById(id, reason);
      return res.json(user);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
  unsuspendUser: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await adminService.unsuspendUserById(id);
      return res.json(user);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  flagDataset: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const dataset = await adminService.flagDatasetById(id, reason);
      return res.json(dataset);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
  unflagDataset: async (req, res) => {
    try {
      logger.info("Unflagging dataset");
      const { id } = req.params;
      const dataset = await adminService.unflagDatasetById(id);
      return res.json(dataset);
    } catch (err) {
      logger.error(`Error unflagging dataset: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  deleteDataset: async (req, res) => {
    try {
      logger.info("Deleting dataset");
      const { id } = req.params;
      const dataset = await adminService.deleteDatasetById(id);
      return res.json(dataset);
    } catch (err) {
      logger.error(`Error deleting dataset: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  approveDataset: async (req, res) => {
    try {
      logger.info("Approving dataset");
      const { id } = req.params;
      const dataset = await adminService.approveDatasetById(id);
      return res.json(dataset);
    } catch (err) {
      logger.error(`Error approving dataset: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  rejectDataset: async (req, res) => {
    try {
      logger.info("Rejecting dataset");
      const { id } = req.params;
      const dataset = await adminService.rejectDatasetById(id);
      return res.json(dataset);
    } catch (err) {
      logger.error(`Error rejecting dataset: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  updateDatasetStatus: async (req, res) => {
    try {
      logger.info("Overriding dataset status");
      const { id } = req.params;
      const { status } = req.body;
      if (!status) throw new Error("Status is required");
      const dataset = await adminService.updateDatasetStatus(id, status);
      return res.json(dataset);
    } catch (err) {
      logger.error(`Error overriding status: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  updateDatasetPriority: async (req, res) => {
    try {
      logger.info("Updating dataset priority");
      const { id } = req.params;
      const { priority } = req.body;
      if (!priority) throw new Error("Priority is required");
      const dataset = await adminService.updateDatasetPriority(id, priority);
      return res.json(dataset);
    } catch (err) {
      logger.error(`Error updating priority: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  updateDatasetMaxLabellers: async (req, res) => {
    try {
      logger.info("Updating dataset max labellers");
      const { id } = req.params;
      const { maxLabellers } = req.body;
      if (!maxLabellers) throw new Error("Max labellers is required");
      const parsedMax = parseInt(maxLabellers, 10);
      const dataset = await adminService.updateDatasetMaxLabellers(id, parsedMax);
      return res.json(dataset);
    } catch (err) {
      logger.error(`Error updating max labellers: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
};
