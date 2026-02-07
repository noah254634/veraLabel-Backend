import { adminService } from "./admin.service.js";
export const adminController = {
  pendingDatasets: async (req, res) => {
    try {
    const datasets = await adminService.pendingDatasets();
    return res.json(datasets);
    }catch(err){
      return res.status(400).json({message:err.message});
    }
  },
  approvedDatasets: async (req, res) => {
    try {
      const datasets = await adminService.approvedDatasets();
      return res.json(datasets);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
  rejectedDatasets: async (req, res) => {
    try {
      const datasets = await adminService.rejectedDatasets();
      return res.json(datasets);
    }catch(err){
      return res.status(400).json({message:err.message});
    }
  },
  flaggedDatasets: async (req, res) => {
    try {
      const datasets = await adminService.flaggedDatasets();
      return res.json(datasets);
    }catch(err){
      return res.status(400).json({message:err.message});
    }
  },

  banUser: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const user = await adminService.banUserById(id, reason);
      return res.json(user);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },

  promoteUser: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await adminService.promoteUserById(id);
      return res.json({
        success: true,
        user,
        message: "User promoted successfully",
      });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
  demoteUser: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await adminService.demoteUserById(id);
      return res.json(user);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
  blockUser: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const user = await adminService.blockUserById(id, reason);
      return res.json(user);
    } catch (err) {
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
      const { id } = req.params;
      const dataset = await adminService.unflagDatasetById(id);
      return res.json(dataset);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
  deleteDataset: async (req, res) => {
    try {
      const { id } = req.params;
      const dataset = await adminService.deleteDatasetById(id);
      return res.json(dataset);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
  approveDataset: async (req, res) => {
    try {
      const { id } = req.params;
      const dataset = await adminService.approveDatasetById(id);
      return res.json(dataset);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
  rejectDataset: async (req, res) => {
    try {
      const { id } = req.params;
      const dataset = await adminService.rejectDatasetById(id);
      return res.json(dataset);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  },
};
