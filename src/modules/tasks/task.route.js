import express from 'express'
import { taskController } from './task.controller.js'
import { protectRoute } from '../../middlewares/auth.middleware.js'
import { attachLabeller } from '../../middlewares/labeller.middleware.js'
import { progressController } from './progress.controller.js'
import { createRateLimiter } from '../../middlewares/rateLimit.middleware.js'

const router = express.Router()

const tasksReadLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120 })
const tasksWriteLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 })
const progressLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 1000 })
const adminLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 100 })

router.post('/createTasks', tasksWriteLimiter, taskController.createTasks)
router.post('/register', tasksWriteLimiter, taskController.createTasks)
router.get('/', tasksReadLimiter, taskController.getTasks)
router.get('/getTask/:id', tasksReadLimiter, taskController.getTaskById)
router.put('/returnTaskToPool/:id', tasksWriteLimiter, taskController.returnTaskToPool)
router.post('/:id/assign', protectRoute, tasksWriteLimiter, taskController.assignTask)
router.put('/submit/:id', protectRoute, attachLabeller, tasksWriteLimiter, taskController.submitTask)
router.put('/verify/:id', tasksWriteLimiter, taskController.verifyTask)
router.put('/rejectTask/:id/reject', tasksWriteLimiter, taskController.rejectTask)
router.delete('/deleteTask/:id', tasksWriteLimiter, taskController.deleteTask)
router.post('/reviewTask/:id', tasksWriteLimiter, taskController.reviewTask)
router.post('/revoke', tasksWriteLimiter, taskController.revokeTask)
router.post('/auto_assign', tasksWriteLimiter, taskController.autoAssignTask)
router.post('/claim-batch', protectRoute, attachLabeller, tasksWriteLimiter, taskController.claimBatch)
router.get('/my-active-batch', protectRoute, attachLabeller, taskController.getMyActiveBatch)
router.get('/batches', protectRoute, taskController.getBatches)
router.post('/progress', progressLimiter, progressController.receiveProgress)
router.get('/progress/admin/cleanup', adminLimiter, progressController.cleanupSessions)
router.get('/progress/admin/stats', adminLimiter, progressController.getStats)
router.get('/progress/admin/sessions', adminLimiter, progressController.getAllSessions)
router.get('/progress/:projectId/:datasetId/stream', progressController.streamProgress)
router.get('/progress/:projectId/:datasetId', tasksReadLimiter, progressController.getProgress)
router.delete('/progress/:projectId/:datasetId', tasksWriteLimiter, progressController.clearProgress)

export default router;