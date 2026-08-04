import { useState } from "react";
import { bindServices, observer, useService } from "@rabjs/react";
import { TodoService } from "./TodoService";

const filters = [
  { key: "all", label: "全部" },
  { key: "active", label: "进行中" },
  { key: "done", label: "已完成" },
] as const;

/**
 * Todo live demo —— 增删改查 + computed 过滤（filteredTodos / remaining）。
 * 输入框是受控的 React 局部 state，列表数据全部来自 TodoService。
 */
const Todo = observer(() => {
  const todo = useService(TodoService);
  const [text, setText] = useState("");

  const submit = () => {
    todo.add(text);
    setText("");
  };

  return (
    <div>
      <div className="demo-row">
        <input
          value={text}
          placeholder="要做点什么？"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          style={{ flex: 1, padding: "6px 10px" }}
        />
        <button className="demo-btn primary" onClick={submit}>
          添加
        </button>
      </div>
      <div className="demo-row">
        {filters.map((f) => (
          <button
            key={f.key}
            className={`demo-btn${todo.filter === f.key ? " primary" : ""}`}
            onClick={() => todo.setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <span style={{ color: "var(--text-dim)" }}>
          剩余 {todo.remaining} 项
        </span>
      </div>
      <ul style={{ margin: "12px 0 0", paddingLeft: 20 }}>
        {todo.filteredTodos.map((t) => (
          <li key={t.id} style={{ marginBottom: 6 }}>
            <label style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => todo.toggle(t.id)}
              />{" "}
              <span
                style={
                  t.done
                    ? { textDecoration: "line-through", color: "var(--text-dim)" }
                    : undefined
                }
              >
                {t.title}
              </span>
            </label>{" "}
            <button className="demo-btn" onClick={() => todo.remove(t.id)}>
              删除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default bindServices(Todo, [TodoService]);
