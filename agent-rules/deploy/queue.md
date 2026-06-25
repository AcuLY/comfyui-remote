# Queue Handling During Deploy

Before build, `.next` cleanup, stopping, or restarting current service, check queue and running task state.

- If this change does not require build, `.next` cleanup, stop, or restart, and only needs checks against the existing service, do not pause the queue.
- If runtime-affecting deployment actions are required and queued/running tasks exist, call `POST /api/queue/pause-active`.
- Record the returned `batchId` and `runIds`.
- Write the deployment's `batchId` and `runIds` into `.deploy.lock/owner.json`.
- After deployment and verification pass, call `POST /api/queue/resume-paused`, preferably using the recorded `batchId` or `runIds`.
- Resume only tasks paused by this deployment. Do not resume tasks that were already paused before this deployment.
