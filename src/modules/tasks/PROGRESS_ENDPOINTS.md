# Progress Tracking Endpoints

## Overview

The progress tracking system provides real-time monitoring of dataset split operations. The worker streams events to these endpoints, which store sessions and push updates to connected clients via Server-Sent Events (SSE).

**Key Architecture:**
- **Worker → Backend:** Worker sends progress events via POST to `/tasks/progress`
- **Backend → Client:** Backend streams session updates via GET `/tasks/progress/:projectId/:datasetId/stream` (SSE)
- **In-Memory Storage:** Sessions stored in `activeSessions` Map with 30-minute auto-cleanup
- **Live Push:** Session subscribers notified immediately when events arrive (no polling)

---

## Endpoints

### 1. POST `/tasks/progress`

**Receive progress updates from the worker.** Worker calls this endpoint to report processing events.

#### Request

```bash
POST /api/v1/tasks/progress
Content-Type: application/json
Authorization: Bearer {backendToken}  # Optional, if configured

{
  "projectId": "proj-123",
  "datasetId": "dataset-456",
  "events": [
    {
      "type": "progress",
      "timestamp": "2026-03-31T10:30:45.123Z",
      "message": "Processed 500 items",
      "metadata": { "count": 500 }
    },
    {
      "type": "checkpoint",
      "timestamp": "2026-03-31T10:30:47.456Z",
      "label": "batch_registered",
      "metrics": { "batchSize": 100, "elapsedMs": 2331 }
    }
  ],
  "isFinal": false,
  "sentAt": "2026-03-31T10:30:48.000Z"
}
```

#### Response

**Status: 200 OK**

```json
{
  "success": true,
  "message": "Received and processed 2/2 events",
  "sessionStatus": "processing",
  "sessionId": "proj-123:dataset-456",
  "processedCount": 2,
  "failedCount": 0,
  "requestId": "req-1234567890"
}
```

#### Error Responses

**Status: 400 Bad Request** (Missing required fields)
```json
{
  "success": false,
  "message": "projectId is required",
  "error": "projectId is required",
  "requestId": "req-1234567890"
}
```

**Status: 500 Server Error** (Processing failed)
```json
{
  "success": false,
  "message": "Failed to process progress update",
  "error": "Internal error details",
  "requestId": "req-1234567890"
}
```

#### Behavior

1. Creates a session if it doesn't exist
2. Validates all events
3. Adds events to the session
4. **Immediately notifies all SSE subscribers** of new events
5. Updates session status based on event types:
   - `error` (critical severity) → `failed`
   - `complete` → `completed`
   - Otherwise → `processing`
6. Auto-cleanup: Session expires after 30 minutes of inactivity

---

### 2. GET `/tasks/progress/:projectId/:datasetId/stream`

**Real-time Server-Sent Events (SSE) stream.** Client connects here to receive live updates.

#### Request

```bash
GET /api/v1/tasks/progress/proj-123/dataset-456/stream?since=2026-03-31T10:30:00.000Z
Accept: text/event-stream
```

**Query Parameters:**
- `since` (optional): ISO timestamp. Only send events after this time.

#### Response Headers

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Transfer-Encoding: chunked
```

#### Event Stream Format

```
data: {"type":"connected","message":"Progress stream connected","timestamp":"2026-03-31T10:30:45.123Z"}

data: {"type":"progress","timestamp":"2026-03-31T10:30:46.000Z","message":"Processed 500 items","metadata":{"count":500},"serverReceivedAt":"2026-03-31T10:30:46.050Z","eventIndex":0}

data: {"type":"checkpoint","timestamp":"2026-03-31T10:30:47.456Z","label":"batch_registered","metrics":{"batchSize":100,"elapsedMs":2331},"serverReceivedAt":"2026-03-31T10:30:47.500Z","eventIndex":1}

data: {"type":"session_complete","status":"completed","summary":{"success":true,"totalCount":1000,"failedBatches":0,"totalDurationMs":5000}}
```

#### Connection Behavior

1. **On Connection:**
   - Sends "connected" confirmation message
   - Sends all recent events (from `since` timestamp if provided, else all events)
   - Subscribes to live events via push mechanism

2. **During Processing:**
   - Receives events in real-time (millisecond latency, no polling)
   - Every 15 seconds: heartbeat comment (`:keep-alive`) keeps connection alive

3. **On Completion:**
   - Receives `session_complete` event when status changes to `completed` or `failed`
   - Connection automatically closes after sending final event

4. **On Disconnection:**
   - Client closes connection → subscriber unsubscribes automatically
   - Server cleans up resources

#### Example Frontend Integration

```javascript
const eventSource = new EventSource(
  '/api/v1/tasks/progress/proj-123/dataset-456/stream'
);

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'connected':
      console.log('Connected to progress stream');
      break;
    case 'progress':
      updateProgressBar(data.metadata);
      console.log(data.message);
      break;
    case 'error':
      showErrorNotification(data.message, data.severity);
      break;
    case 'checkpoint':
      console.log(`Checkpoint: ${data.label}`, data.metrics);
      break;
    case 'session_complete':
      console.log('Processing complete!', data.summary);
      eventSource.close();
      break;
  }
});

eventSource.addEventListener('error', () => {
  console.error('Stream connection lost');
  eventSource.close();
  // Reconnect or show offline message
});
```

---

### 3. GET `/tasks/progress/:projectId/:datasetId`

**Get final status and summary of a processing session.**

#### Request

```bash
GET /api/v1/tasks/progress/proj-123/dataset-456
```

#### Response (Status: 200 OK)

```json
{
  "success": true,
  "data": {
    "sessionId": "proj-123:dataset-456",
    "status": "completed",
    "projectId": "proj-123",
    "datasetId": "dataset-456",
    "durationMs": 5234,
    "startTime": "2026-03-31T10:30:30.000Z",
    "endTime": "2026-03-31T10:30:35.234Z",
    "createdAt": "2026-03-31T10:30:30.000Z",
    "eventCounts": {
      "progress": 12,
      "error": 0,
      "checkpoint": 3,
      "complete": 1
    },
    "eventMetrics": {
      "processed": 16,
      "errors": 0,
      "warnings": 0,
      "checkpoints": 3
    },
    "errorCount": 0,
    "errors": [],
    "lastProgressUpdate": 1000,
    "failureReason": null,
    "completionSummary": {
      "success": true,
      "totalCount": 1000,
      "failedBatches": 0,
      "totalDurationMs": 5000
    },
    "lastUpdate": "2026-03-31T10:30:35.234Z"
  }
}
```

#### Error Responses

**Status: 404 Not Found** (Session doesn't exist)
```json
{
  "success": false,
  "message": "Progress session not found"
}
```

**Status: 500 Server Error**
```json
{
  "success": false,
  "message": "Failed to fetch progress",
  "error": "Internal error details"
}
```

---

### 4. DELETE `/tasks/progress/:projectId/:datasetId`

**Clear a progress session and stop all subscriptions.**

#### Request

```bash
DELETE /api/v1/tasks/progress/proj-123/dataset-456
```

#### Response (Status: 200 OK)

```json
{
  "success": true,
  "message": "Progress session cleared successfully"
}
```

#### Error Response

**Status: 404 Not Found**
```json
{
  "success": false,
  "message": "Progress session not found"
}
```

#### Behavior

- Removes session from `activeSessions` Map
- Removes all subscribers for that session
- Unsubscribes any active SSE clients
- Auto-cleanup timer is cleared

---

## Admin Endpoints

### 5. GET `/tasks/progress/admin/sessions`

**Get all active sessions (admin only).**

#### Request

```bash
GET /api/v1/tasks/progress/admin/sessions?status=processing
```

**Query Parameters:**
- `status` (optional): Filter by status (`processing`, `completed`, `failed`)

#### Response (Status: 200 OK)

```json
{
  "success": true,
  "data": [
    {
      "sessionId": "proj-123:dataset-456",
      "projectId": "proj-123",
      "datasetId": "dataset-456",
      "status": "processing",
      "startTime": "2026-03-31T10:30:30.000Z",
      "eventCount": 12,
      "eventMetrics": {
        "processed": 12,
        "errors": 0,
        "warnings": 0,
        "checkpoints": 3
      },
      "durationMs": 15234
    }
  ],
  "stats": {
    "activeSessions": 1,
    "totalEvents": 12,
    "totalErrors": 0,
    "completedSessions": 0,
    "failedSessions": 0,
    "processingCount": 1,
    "timestamp": "2026-03-31T10:30:45.000Z"
  },
  "count": 1
}
```

---

### 6. GET `/tasks/progress/admin/stats`

**Get system-wide statistics (admin only).**

#### Request

```bash
GET /api/v1/tasks/progress/admin/stats
```

#### Response (Status: 200 OK)

```json
{
  "success": true,
  "data": {
    "activeSessions": 3,
    "totalEvents": 156,
    "totalErrors": 2,
    "completedSessions": 10,
    "failedSessions": 1,
    "processingCount": 2,
    "timestamp": "2026-03-31T10:30:45.000Z"
  }
}
```

#### Metrics

| Field | Description |
|-------|-------------|
| `activeSessions` | Number of sessions currently in memory |
| `totalEvents` | Sum of all events across all sessions |
| `totalErrors` | Sum of error-type events |
| `completedSessions` | Sessions with status='completed' |
| `failedSessions` | Sessions with status='failed' |
| `processingCount` | Sessions still processing (active - completed - failed) |

---

### 7. GET `/tasks/progress/admin/cleanup`

**Manually trigger cleanup of expired sessions (admin only).**

#### Request

```bash
GET /api/v1/tasks/progress/admin/cleanup
```

#### Response (Status: 200 OK)

```json
{
  "success": true,
  "message": "Session cleanup completed",
  "cleanupResult": {
    "cleaned": 5,
    "remaining": 3
  },
  "stats": {
    "activeSessions": 3,
    "totalEvents": 89,
    "totalErrors": 0,
    "completedSessions": 10,
    "failedSessions": 0,
    "processingCount": 3,
    "timestamp": "2026-03-31T10:30:45.000Z"
  }
}
```

#### Behavior

- Removes sessions inactive for >30 minutes
- Clears timeouts for removed sessions
- Returns count of cleaned sessions

---

## Session Lifecycle

### States

```
[Created] → [Processing] → [Completed or Failed] → [Auto-deleted after 30min]
```

### State Transitions

| Event | Triggers | New State |
|-------|----------|-----------|
| First event received | Any event | `processing` |
| Error (critical severity) | `error` type + severity='critical' | `failed` |
| Complete event | `type='complete'` | `completed` |
| 30 minutes without activity | Timeout | Auto-deleted |

### Event Types

```javascript
{
  "type": "progress",      // Regular progress message
  "type": "error",         // Error occurred (critical or warning)
  "type": "checkpoint",    // Processing milestone
  "type": "complete"       // Processing finished
}
```

---

## Data Flow Example

### Scenario: Processing a CSV dataset

```
1. Worker receives POST request with sample_text.csv
   ↓
2. Worker creates ProgressLogger instance
   ↓
3. Worker sends: POST /tasks/progress
   { projectId: "proj-123", datasetId: "ds-456", events: [progress event] }
   ↓
4. Backend:
   - Creates session "proj-123:ds-456"
   - Adds event to session
   - NOTIFIES all subscribed SSE clients (live push, no polling)
   ↓
5. Frontend (already connected via SSE):
   - Receives progress event in real-time
   - Updates progress bar
   ↓
6. Worker continues processing, sends periodic updates
   ↓
7. Worker sends final: POST /tasks/progress
   { ..., isFinal: true, events: [complete event] }
   ↓
8. Backend:
   - Sets session status = "completed"
   - Notifies SSE clients with session_complete message
   - SSE closes connection
   ↓
9. Frontend:
   - Shows final summary
   - Can optionally call GET /tasks/progress/:projectId/:datasetId for full details
```

---

## Error Handling

### Validation

All endpoints validate input:
- `projectId` and `datasetId` required (non-empty strings)
- Events must be an array with >0 items
- Event must have `type` from VALID_EVENT_TYPES
- Severity (if present) must be from VALID_SEVERITIES

### Failed Events

If an event fails validation, it's logged and skipped:

```json
{
  "success": true,
  "message": "Received and processed 1/2 events",
  "processedCount": 1,
  "failedCount": 1,
  "failedEvents": [
    {
      "index": 1,
      "error": "event.severity must be one of: info, warning, critical"
    }
  ]
}
```

### Timeout Behavior

- SSE connections: 15-second heartbeat keeps alive indefinitely
- Session timeout: 30 minutes of inactivity
- Manually trigger cleanup via `GET /admin/cleanup`

---

## Rate Limiting

All endpoints have rate limiters configured in [task.route.js](task.route.js):

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Progress POST | 1000/min | 1 minute |
| Progress GET | 120/min | 1 minute |
| Progress DELETE | 30/min | 1 minute |
| Admin endpoints | 100/min | 1 minute |

---

## Logging

All operations are logged to `logger` (Pino):

```javascript
// Progress update received
logger.info('Progress update received', { requestId, body: {...} });

// Event added
logger.debug('Event added to session', { sessionId, eventType, eventCount });

// Session auto-cleanup
logger.info('Session auto-cleaned after timeout', { sessionId, durationMs: 30*60*1000 });
```

Check backend logs for troubleshooting.

---

## Testing

### Test receiving progress (worker → backend)

```bash
curl -X POST http://localhost:5000/api/v1/tasks/progress \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test",
    "datasetId": "test",
    "events": [
      {
        "type": "progress",
        "timestamp": "2026-03-31T10:30:45.123Z",
        "message": "Test message",
        "metadata": {}
      }
    ],
    "isFinal": false
  }'
```

### Test SSE stream (client listening)

```bash
curl -X GET http://localhost:5000/api/v1/tasks/progress/test/test/stream
```

(Will wait for events; send test progress POST in another terminal)

### Test final status

```bash
curl -X GET http://localhost:5000/api/v1/tasks/progress/test/test
```

### Test admin endpoints

```bash
# Get all sessions
curl http://localhost:5000/api/v1/tasks/progress/admin/sessions

# Get stats
curl http://localhost:5000/api/v1/tasks/progress/admin/stats

# Cleanup
curl http://localhost:5000/api/v1/tasks/progress/admin/cleanup
```

---

## Performance Notes

- **Push vs Poll:** Using SSE subscriptions (push) instead of polling eliminates 5-second latency
- **Concurrency:** Serialized flushes in worker prevent request storms
- **Memory:** In-memory storage suitable for development; consider Redis for production
- **Scalability:** Each worker instance maintains its own session Map. For multi-instance backend, use shared session store (Redis, database)

---

## Production Considerations

1. **Replace In-Memory Storage:** Use Redis or a database instead of `Map` for persistence and clustering
2. **Session Expiry:** Review 30-minute timeout; adjust based on expected dataset sizes
3. **Event Limit:** `MAX_EVENTS_PER_SESSION = 10000` shifts oldest event if exceeded; adjust for large datasets
4. **Logging:** Consider log shipping for audit trail
5. **Metrics:** Export `activeSessions`, `totalEvents` for monitoring
6. **Authentication:** Add JWT verification to admin endpoints
