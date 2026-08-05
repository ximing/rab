import { bindServices, observer, useService } from "@rabjs/react";
import { UserService } from "./UserService";

/**
 * 异步加载 live demo —— async 方法（默认就是 Action 语义）+ $model loading/error。
 * 注意 loadUser 抛出异常时 error 会进入 $model.loadUser.error，
 * 这里用 .catch(() => {}) 吞掉未处理的 rejection（error 已在 UI 中展示）。
 */
const User = observer(() => {
  const user = useService(UserService);
  const { loading, error } = user.$model.loadUser;

  const load = (id: number) => {
    user.loadUser(id).catch(() => {});
  };

  return (
    <div>
      <div className="demo-row">
        <button className="demo-btn primary" onClick={() => load(1)}>
          加载 Alice
        </button>
        <button className="demo-btn" onClick={() => load(2)}>
          加载 Bob
        </button>
        <button className="demo-btn" onClick={() => load(404)}>
          加载不存在的用户
        </button>
      </div>
      {loading ? <p style={{ color: "var(--text-dim)" }}>加载中…</p> : null}
      {error ? <p style={{ color: "#e06c75" }}>出错了：{error.message}</p> : null}
      {!loading && user.profile ? (
        <p>
          {user.profile.name}（id: {user.profile.id}）—— {user.profile.bio}
        </p>
      ) : null}
    </div>
  );
});

export default bindServices(User, [UserService]);
