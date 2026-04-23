# Labeller Module Architecture

## Overview
Separate, comprehensive module for managing labeller profiles, performance, earnings, and task assignments. Fully decoupled from reviewer analytics and other modules.

## Module Structure

```
src/modules/labeller/
├── labeller.model.js                    # Labeller data schema
├── labeller.service.js                  # Core business logic
├── labeller.controller.js               # Request handlers
├── labeller.routes.js                   # API endpoints
├── labeller.analytics.service.js        # Analytics queries
├── labeller.analytics.controller.js     # Analytics handlers
├── labeller.analytics.routes.js         # Analytics endpoints
└── README.md                            # This file
```

## Database Schema (labeller.model.js)

### Core Fields
- **userId**: Reference to UserVera document
- **tier**: Trainee | Bronze | Silver | Gold
- **isOnboarded**: Completion status of onboarding
- **profile**: Location, age, gender, languages, timezone
- **expertise**: Skills, annotation types, tools, years of experience

### Performance Tracking
- **performance**: Quality score, completion rate, reliability score, approval rate
- **completedTasksLog**: Historical task records with quality scores

### Earnings & Payments
- **earnings**: Total earned, current balance, pending, payouts tracking
- **lastPayoutDate**: Timestamp of most recent payment

### Task Management
- **currentAssignedTasks**: Active task queue
- **completedTasksLog**: Task history with approval status

### Training & Certification
- **training**: Completed tiers, current progress, certifications
- **tier**: Auto-updated based on training progression

### Status Management
- **status**: active | inactive | suspended | banned
- **activityMetrics**: Last activity, login count, streaks

### Ratings & Reviews
- **reviews**: Array of review objects from other users
- **averageRating**: Calculated average of all reviews

### Preferences
- **preferences**: Task type preferences, notification settings, max concurrent tasks

## Service Layer (labeller.service.js)

All errors bubble up to controller for centralized handling.

### Profile Management
- `createLabellerProfile(userId, profileData)` - Create new labeller profile
- `getLabellerProfile(labellerUserId)` - Fetch profile with user details
- `updateLabellerProfile(labellerUserId, updates)` - Update profile fields

### Performance Metrics
- `getPerformanceMetrics(labellerUserId)` - Get performance data
- `updatePerformanceMetrics(labellerUserId, taskQualityScore)` - Recalculate and update

### Task Management
- `assignTasksToLabeller(labellerUserId, taskIds)` - Assign new tasks
- `getAssignedTasks(labellerUserId)` - Fetch active tasks
- `completeTask(labellerUserId, taskId, qualityScore)` - Mark task as done
- `rejectTask(labellerUserId, taskId)` - Move task back to queue

### Earnings & Payments
- `getEarnings(labellerUserId)` - Get earnings breakdown
- `updateEarnings(labellerUserId, amount, type)` - Add earnings or process payout

### Tier Management
- `promoteLabellerTier(labellerUserId, newTier)` - Promote to next tier
- `getTier(labellerUserId)` - Get current tier and progress

### Status Management
- `updateLabellerStatus(labellerUserId, status, reason)` - Update labeller status

### Analytics
- `getTopLabellersByPerformance(limit)` - Rank by reliability score
- `getLabellersByTier(tier)` - Filter by tier
- `getLabellerStats(labellerUserId)` - Comprehensive stats summary
- `updateLastActivity(labellerUserId)` - Track activity

## Analytics Layer (labeller.analytics.service.js)

Parallelized queries with `.lean()` for read-only performance.

### Overall Statistics
- `getTotalLabellersCount()` - Total labeller count
- `getActiveLabellerCount()` - Active status count
- `getLabellersByStatus()` - Status distribution with percentages

### Performance Analytics
- `getAveragePerformanceMetrics()` - Average across all active labellers
- `getPerformanceDistribution()` - Quality score distribution buckets

### Tier Analytics
- `getLabellersByTierWithStats()` - Per-tier metrics and earnings
- `getTierPromotionTrend(days)` - Promotion count trend

### Earnings Analytics
- `getTotalEarningsPaid()` - Total earnings, payouts, pending
- `getEarningsDistribution()` - Earnings range distribution
- `getTopEarners(limit)` - Top earners ranked by total earned

### Activity Analytics
- `getActivityMetrics()` - Active last 7/30 days, activity rates

### Task Completion Analytics
- `getTaskCompletionStats()` - Assignment vs completion vs rejection

### Rating Analytics
- `getAverageRating()` - Overall average rating
- `getRatingDistribution()` - Rating range distribution

## API Endpoints

### Labeller Self-Endpoints (GET /api/labeller/...)

#### Profile Management
- `POST /profile` - Create profile
- `GET /profile` - Fetch own profile
- `PATCH /profile` - Update own profile

#### Tasks
- `GET /tasks/assigned` - Get assigned tasks
- `POST /tasks/:taskId/complete` - Mark task complete with quality score
- `POST /tasks/:taskId/reject` - Reject task

#### Stats & Earnings
- `GET /earnings` - Get earnings breakdown
- `GET /performance` - Get performance metrics
- `GET /tier` - Get tier and progress
- `GET /stats` - Get comprehensive stats

### Admin Endpoints (GET /api/labeller/admin/...)

#### Analytics
- `GET /analytics/overview` - Dashboard overview
- `GET /analytics/performance` - Performance distribution
- `GET /analytics/tiers` - Tier analysis
- `GET /analytics/earnings` - Earnings analysis
- `GET /analytics/activity` - Activity metrics
- `GET /analytics/task-completion` - Task stats
- `GET /analytics/ratings` - Rating analytics

#### Management
- `GET /top-performers` - Top labellers by performance
- `GET /by-tier/:tier` - Labellers in tier
- `PATCH /status` - Update labeller status
- `PATCH /promote-tier` - Promote tier
- `POST /assign-tasks` - Assign tasks

## Error Handling

All service methods throw errors that bubble up:
- Controller catches and returns HTTP response with error message
- Errors logged via logger module
- User-friendly error messages in responses

## Performance Optimizations

1. **Indexing**: Frequent query fields indexed (userId, tier, status, performance scores)
2. **Parallelization**: `Promise.all()` for independent queries
3. **Lean Queries**: Read-only analytics use `.lean()` for minimal overhead
4. **Field Selection**: APIs return only necessary fields
5. **Pagination**: Admin endpoints support limit/offset for large datasets

## Integration Points

### With Task Module
- Task assignment/completion updates labeller performance
- Task quality scores calculated by reviewer

### With User Module
- UserVera reference for user identity
- Profile integration

### With Reviewer Module
- Reviewer sets task quality scores
- Separate analytics prevent coupling

### With Payment Module
- Earnings tracked, payout requests processed separately

## Future Enhancements

- [ ] Skill-based task recommendation engine
- [ ] Automatic tier promotion based on performance thresholds
- [ ] Labeller notification system
- [ ] Batch task assignment optimization
- [ ] Performance trending and predictions
- [ ] Labeller certification program
- [ ] Peer review system
