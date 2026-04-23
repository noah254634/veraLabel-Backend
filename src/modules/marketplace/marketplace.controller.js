import { marketplaceService } from "./marketplace.service.js";
import logger from "../../config/logger.js";
export const marketplaceController = {
  getOrders:async(req,res)=>{
    try{
      const buyerId=req.user._id;
      const orders=await marketplaceService.getOrders(buyerId);
      return res.status(200).json({orders})
    }catch(err){
      logger.error(err.message);
      return res.status(500).json({message:err.message})
    }
  },

  getBuyerRequests: async (req, res) => {
    try {
      const buyerDatasetOrders = await marketplaceService.getdatasetOrders(
        req.user._id,
      );
      return res.status(200).json({ buyerDatasetOrders });
    }catch(err){
      logger.error(err.message);
      return res.status(500).json({ message: err.message });
    }
  },
  createOrder: async (req, res) => {
    try {
      console.log(req.body);
      const { datasetId, datasetPrice } = req.body;
      const buyerId = req.user._id;
      const response = await marketplaceService.createOrder(
        buyerId,
        datasetId,
        datasetPrice,
      );
      return res.status(200).json({ response });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
  unpublishDataset: async (req, res) => {
    try {
      const { id } = req.params;
      const response = await marketplaceService.unpublishDataset(id);
      return res.status(200).json({ response });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
  alldatasets: async (_, res) => {
    try {
      const datasets = await marketplaceService.alldatasets();
      return res.status(200).json({ datasets });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
  getVerifiedDataset: async (req, res) => {
    try {
      const datasets = await marketplaceService.getVerifiedDatasets();
      return res.status(200).json({ datasets });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
  querydatasetByTitle: async (req, res) => {
    try {
      const { title } = req.query;
      const datasets = await marketplaceService.querydatasetByTitle(title);
      return res.status(200).json({ datasets });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
  
  cancelPayment: async (req, res) => {
    try {
      const { orderId } = req.params;
      const buyerId = req.user._id;
      const response = await marketplaceService.cancelPayment(orderId, buyerId);
      return res.status(200).json({ message: "Payment cancelled successfully", response });
    } catch (err) {
      logger.error(err.message);
      return res.status(500).json({ message: err.message });
    }
  },

  reportIssue: async (req, res) => {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;
      const buyerId = req.user._id;
      const response = await marketplaceService.reportIssue(orderId, buyerId, reason);
      return res.status(200).json({ message: "Issue reported successfully", response });
    } catch (err) {
      logger.error(err.message);
      return res.status(500).json({ message: err.message });
    }
  },
};
