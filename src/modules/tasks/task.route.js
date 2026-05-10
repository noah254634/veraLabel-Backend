import express from 'express'
import { taskController } from './task.controller.js'
import { progressController } from './progress.controller.js'
import { createRateLimiter } from '../../middlewares/rateLimit.middleware.js'

const router = express.Router()

// Rate limiters with appropriate limits
const tasksReadLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120 })
const tasksWriteLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 })
const progressLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 1000 }) // Higher limit for progress updates
const adminLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 100 })

// Task CRUD routes with rate limiting and descriptive names
router.post('/createTasks', tasksWriteLimiter, taskController.createTasks)
router.post('/register', tasksWriteLimiter, taskController.createTasks) // Alias for worker compatibility
router.get('/', tasksReadLimiter, taskController.getTasks)
router.get('/getTask/:id', tasksReadLimiter, taskController.getTaskById)
router.put('/returnTaskToPool/:id', tasksWriteLimiter, taskController.returnTaskToPool)
router.post('/:id/assign', tasksWriteLimiter, taskController.assignTask)
router.put('/submit/:id', tasksWriteLimiter, taskController.submitTask)
router.put('/verify/:id', tasksWriteLimiter, taskController.verifyTask)
router.put('/rejectTask/:id/reject', tasksWriteLimiter, taskController.rejectTask)
router.delete('/deleteTask/:id', tasksWriteLimiter, taskController.deleteTask)
router.post('/reviewTask/:id', tasksWriteLimiter, taskController.reviewTask)
router.post('/revoke', tasksWriteLimiter, taskController.revokeTask)
router.post('/auto_assign', tasksWriteLimiter, taskController.autoAssignTask)

// Progress tracking routes (for worker updates)
// IMPORTANT: Specific routes must come before dynamic routes to avoid conflicts!
router.post('/progress', progressLimiter, progressController.receiveProgress)

// Admin progress management routes (must come BEFORE dynamic :projectId/:datasetId routes)
router.get('/progress/admin/cleanup', adminLimiter, progressController.cleanupSessions)
router.get('/progress/admin/stats', adminLimiter, progressController.getStats)
router.get('/progress/admin/sessions', adminLimiter, progressController.getAllSessions)

// Dynamic progress routes (comes after admin routes so /admin paths match first)
router.get('/progress/:projectId/:datasetId/stream', progressController.streamProgress)
router.get('/progress/:projectId/:datasetId', tasksReadLimiter, progressController.getProgress)
router.delete('/progress/:projectId/:datasetId', tasksWriteLimiter, progressController.clearProgress)

export default router;