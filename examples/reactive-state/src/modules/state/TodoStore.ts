/**
 * Todo Store - 用于演示 useLocalObservable
 */
export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export function createTodoStore() {
  return {
    todos: [] as Todo[],
    filter: 'all' as 'all' | 'active' | 'completed',

    get filteredTodos() {
      switch (this.filter) {
        case 'active':
          return this.todos.filter(t => !t.completed);
        case 'completed':
          return this.todos.filter(t => t.completed);
        default:
          return this.todos;
      }
    },

    get stats() {
      return {
        total: this.todos.length,
        active: this.todos.filter(t => !t.completed).length,
        completed: this.todos.filter(t => t.completed).length,
      };
    },

    addTodo(text: string) {
      this.todos.push({
        id: Date.now(),
        text,
        completed: false,
      });
    },

    toggleTodo(id: number) {
      const todo = this.todos.find(t => t.id === id);
      if (todo) {
        todo.completed = !todo.completed;
      }
    },

    removeTodo(id: number) {
      const index = this.todos.findIndex(t => t.id === id);
      if (index !== -1) {
        this.todos.splice(index, 1);
      }
    },

    setFilter(filter: 'all' | 'active' | 'completed') {
      this.filter = filter;
    },

    clearCompleted() {
      this.todos = this.todos.filter(t => !t.completed);
    },
  };
}
