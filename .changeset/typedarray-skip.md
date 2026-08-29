---
'@rabjs/observer': patch
---

`observable()` 不再包装 TypedArray / DataView（`ArrayBuffer.isView`）。此前 9 种旧 TypedArray 被错误包进 base proxy，`length`/`fill`/`[...ta]` 抛 `incompatible receiver`（#190）；`BigInt64Array` / `Float16Array` 则本来就不包装。现在与 Date 一样原样返回，方法可用。若曾依赖 `ta[0] =` 触发 reaction，请改用普通数组，或把 view 放在容器里替换整段 buffer（`state.bytes = new Uint8Array(...)`）。
