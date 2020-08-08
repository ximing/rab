const taskQueue = new Set<Function>();

const scheduler = {
  isOn: false,
  add(task: Function) {
    if (scheduler.isOn) {
      taskQueue.add(task);
    } else {
      task();
    }
  },
  flush() {
    taskQueue.forEach((task) => task());
    taskQueue.clear();
  },
  on() {
    scheduler.isOn = true;
  },
  off() {
    scheduler.isOn = false;
  },
};

export default scheduler;
