import cron, { type ScheduledTask } from "node-cron";

export type SchedulerHandle = {
  stop: () => void;
};

export function startIntervalScheduler(opts: { intervalMinutes: number; onTick: () => Promise<void> }): SchedulerHandle {
  const minutes = Math.max(1, Math.floor(opts.intervalMinutes));
  const expr = `*/${minutes} * * * *`;

  let running = false;
  const task: ScheduledTask = cron.schedule(expr, async () => {
    if (running) return;
    running = true;
    try {
      await opts.onTick();
    } finally {
      running = false;
    }
  });

  task.start();

  return {
    stop: () => task.stop()
  };
}

