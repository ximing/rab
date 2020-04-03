class Queue {
  taskSet: Set<any>;
  isInsideBatch: boolean;

  constructor() {
    this.taskSet = new Set();
    this.isInsideBatch = false;
  }

  add = (task: Function) => {
    if (this.isInsideBatch) {
      this.taskSet.add(task);
    } else {
      task();
    }
  };

  flush = () => {
    if (this.taskSet.size !== 0) {
      this.taskSet.forEach((task) => task());
      this.taskSet.clear();
    }
  };

  on = () => {
    this.isInsideBatch = true;
  };

  off = () => {
    this.isInsideBatch = false;
  };
}

export const queue = new Queue();
