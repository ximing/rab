---
'@rabjs/react': patch
---

Class components wrapped by `view()` now start dependency tracking only after the first commit (`componentDidMount` creates the reaction and forces one re-render to collect deps; pre-commit renders run raw). A discarded render pass can no longer leak a live reaction that keeps calling `forceUpdate` on a dead instance — class components cannot use the `useObserver` FinalizationRegistry backstop because the leaked subgraph is self-sustaining. This also moves the static-rendering check from constructor-time to render-time, matching the function-component path (#254). Additionally, lifecycle methods declared as arrow-function class fields (`componentDidMount = () => {...}`) no longer shadow the wrapper's revival/cleanup logic: they are rebound in the constructor to run both the user's field and the wrapper logic.
