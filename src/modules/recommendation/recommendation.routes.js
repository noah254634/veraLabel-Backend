import express from 'express';
import { recommendationController } from './recommendation.controller.js';

const router = express.Router();

// GET /recommendation/user/:userId?labellerId=&limit=
router.get('/user/:userId', recommendationController.getForUser);

// GET /recommendation/similar/:datasetId?limit=
router.get('/similar/:datasetId', recommendationController.getSimilar);

export default router;
