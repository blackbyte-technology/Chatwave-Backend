import pkg from 'bullmq';
const { Queue, Worker } = pkg;
import IORedis from 'ioredis';

let _redisConnection = null;
let _automationSchedulerQueue = null;
let _automationSchedulerWorker = null;
let _isInitialized = false;
let _redisErrorLogged = false;

const initializeAutomationScheduler = async () => {
    if (_isInitialized) {
        return { queue: _automationSchedulerQueue, worker: _automationSchedulerWorker, redisConnection: _redisConnection };
    }

    _isInitialized = true;

    try {
        _redisConnection = new IORedis(process.env.REDIS_URL || {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy: (times) => {
                return Math.min(times * 500, 2000);
            }
        });

        _automationSchedulerQueue = new Queue('automation-scheduler', {
            connection: _redisConnection,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                timeout: 120000,
                removeOnComplete: { count: 1000 },
                removeOnFail: { count: 500 },
            },
        });

        console.log('[AutomationScheduler] Creating worker with Redis connection');
        _automationSchedulerWorker = new Worker(
            'automation-scheduler',
            async (job) => {
                const { executionId, flowId, nextNodeId, userId, jobType, waitNodeId } = job.data;

                console.log(`=== AUTOMATION SCHEDULER JOB ${job.id} ===`, {
                    executionId,
                    flowId,
                    nextNodeId,
                    jobType: jobType || 'delay_resume',
                    timestamp: new Date().toISOString()
                });

                try {
                    // Dynamic import to avoid circular dependency
                    const { default: automationEngine } = await import('../utils/automation-engine.js');

                    if (jobType === 'reply_timeout') {
                        await automationEngine.resumeFromReplyTimeout(executionId, flowId, nextNodeId, waitNodeId, userId);
                    } else {
                        await automationEngine.resumeFromDelay(executionId, flowId, nextNodeId, userId);
                    }

                    console.log(`=== COMPLETED AUTOMATION SCHEDULER JOB ${job.id} ===`, {
                        executionId,
                        timestamp: new Date().toISOString()
                    });

                    return { status: 'completed', executionId };
                } catch (error) {
                    console.error(`[AutomationScheduler] Error processing job ${job.id}:`, error.message);
                    throw error;
                }
            },
            {
                connection: _redisConnection,
                concurrency: 10,
                limiter: {
                    max: 10,
                    duration: 1000,
                },
            }
        );

        _automationSchedulerWorker.on('completed', (job) => {
            console.log(`[AutomationScheduler] Job ${job.id} completed successfully`);
        });

        _automationSchedulerWorker.on('failed', (job, err) => {
            console.error(`[AutomationScheduler] Job ${job.id} failed:`, err.message);
        });

        _automationSchedulerWorker.on('error', (err) => {
            if (!_redisErrorLogged) {
                console.error(`[AutomationScheduler] Worker error:`, err.message);
            }
        });

        _automationSchedulerQueue.on('error', (err) => {
            if (!_redisErrorLogged) {
                console.error(`[AutomationScheduler] Queue error:`, err.message);
            }
        });

        _redisConnection.on('error', (err) => {
            if (!_redisErrorLogged) {
                console.warn('[AutomationScheduler] Redis connection error:', err.message);
                _redisErrorLogged = true;
            }
        });

        console.log('[AutomationScheduler] Queue and worker initialized successfully');

    } catch (error) {
        if (!_redisErrorLogged) {
            console.error('[AutomationScheduler] Failed to connect to Redis:', error.message);
            console.log('[AutomationScheduler] Scheduler system disabled.');
            _redisErrorLogged = true;
        }

        // Fallback: no-op queue when Redis is unavailable
        _automationSchedulerQueue = {
            add: async (name, data, options) => {
                console.warn('[AutomationScheduler] Redis not available. Cannot schedule delayed job:', name);
                return { id: Math.random().toString(36).substr(2, 9) };
            },
            getJob: async () => null,
            remove: async () => {}
        };

        _automationSchedulerWorker = null;
        _redisConnection = null;
    }

    return { queue: _automationSchedulerQueue, worker: _automationSchedulerWorker, redisConnection: _redisConnection };
};

/**
 * Schedule a delayed automation execution resume.
 * @param {Object} params
 * @param {string} params.executionId - The AutomationExecution _id
 * @param {string} params.flowId - The AutomationFlow _id
 * @param {string} params.nextNodeId - The node ID to resume from after delay
 * @param {string} params.userId - The user who owns this execution
 * @param {number} params.delayMs - Delay in milliseconds
 * @returns {Promise<Object>} BullMQ job
 */
export const scheduleDelayedResume = async ({ executionId, flowId, nextNodeId, userId, delayMs }) => {
    const { queue } = await initializeAutomationScheduler();

    const jobName = `delay-resume-${executionId}`;
    const job = await queue.add(jobName, {
        executionId,
        flowId,
        nextNodeId,
        userId
    }, {
        delay: delayMs,
        jobId: `delay-${executionId}-${Date.now()}`
    });

    console.log(`[AutomationScheduler] Scheduled delay resume in ${delayMs}ms (${Math.round(delayMs / 3600000)}h). Job: ${job.id}`);

    return job;
};

/**
 * Schedule a wait_for_reply timeout. When it fires, the execution resumes down
 * the same next node but with a __reply_timed_out flag set — but only if no
 * reply arrived in the meantime (verified by the engine before resuming).
 * @param {Object} params
 * @param {string} params.executionId
 * @param {string} params.flowId
 * @param {string} params.waitNodeId - The wait_for_reply node id being timed out
 * @param {string} params.nextNodeId - The node to resume from on timeout
 * @param {string} params.userId
 * @param {number} params.delayMs
 * @returns {Promise<Object>} BullMQ job
 */
export const scheduleReplyTimeout = async ({ executionId, flowId, waitNodeId, nextNodeId, userId, delayMs }) => {
    const { queue } = await initializeAutomationScheduler();

    const jobName = `reply-timeout-${executionId}`;
    const job = await queue.add(jobName, {
        jobType: 'reply_timeout',
        executionId,
        flowId,
        waitNodeId,
        nextNodeId,
        userId
    }, {
        delay: delayMs,
        jobId: `reply-timeout-${executionId}-${Date.now()}`
    });

    console.log(`[AutomationScheduler] Scheduled reply timeout in ${delayMs}ms (${Math.round(delayMs / 3600000)}h) for node ${waitNodeId}. Job: ${job.id}`);

    return job;
};

/**
 * Cancel a scheduled delay job.
 * @param {string} jobId - The BullMQ job ID to cancel
 */
export const cancelDelayedResume = async (jobId) => {
    if (!jobId) return;

    try {
        const { queue } = await initializeAutomationScheduler();
        const job = await queue.getJob(jobId);
        if (job) {
            await job.remove();
            console.log(`[AutomationScheduler] Cancelled delay job: ${jobId}`);
        }
    } catch (error) {
        console.warn(`[AutomationScheduler] Could not cancel job ${jobId}:`, error.message);
    }
};

export const getAutomationSchedulerQueue = async () => {
    const { queue, worker } = await initializeAutomationScheduler();
    if (worker) {
        console.log('[AutomationScheduler] Worker is ready to process jobs');
    }
    return queue;
};

export default {
    scheduleDelayedResume,
    scheduleReplyTimeout,
    cancelDelayedResume,
    getAutomationSchedulerQueue
};
