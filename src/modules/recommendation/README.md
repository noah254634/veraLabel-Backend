Recommendation module (deterministic, non-AI)
===========================================

Overview
--------
- This module provides a lightweight, rule-based recommendation engine suitable for local testing.
- It intentionally contains no AI or ML model code — just deterministic heuristics (popularity, recency, simple feature matching).
- The module is modular and not mounted into the main app; you should wire the routes in `app.js` or your router when ready.

Files
-----
- `recommendation.service.js` — core recommendation logic (public methods exportable)
- `recommendation.controller.js` — minimal HTTP controller that wraps the service
- `recommendation.routes.js` — express routes (not mounted)
- `recommendation.model.js` — optional cache / artifact model (placeholder)

Usage
-----
- Import the service directly for server-side use:

  const { recommendationService } = require('./modules/recommendation/recommendation.service');

- Or mount the routes in your Express app:

  import recommendationRoutes from './modules/recommendation/recommendation.routes.js';
  app.use('/api/v1/recommendation', recommendationRoutes);

Notes
-----
- No external configuration or AI libraries are used.
- The service uses existing `Dataset`, `Submission` and `Task` collections to compute recommendations.
- You may adapt or extend heuristics inside `recommendation.service.js` to add business rules, caching, or additional signals.
