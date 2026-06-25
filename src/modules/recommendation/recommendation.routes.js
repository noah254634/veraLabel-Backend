import express from 'express';
import { recommendationController } from './recommendation.controller.js';

const router = express.Router();

router.get('/user/:userId', recommendationController.getForUser);

router.get('/similar/:datasetId', recommendationController.getSimilar);

export default router;
