# RAB — AI-First Reactive State Architecture

[English](./README.md) | [简体中文](./README.zh-CN.md)

> A reactive state architecture where humans and AI agents operate on the same observable state surface.

![RAB AI First architecture](docs/assets/ai-first-state.svg)

## Why RAB

Most state-management approaches give the UI, tests, developer tools, and automation separate ways to understand an application. RAB makes the reactive Service state the shared contract instead. A person clicking a button, a test making an assertion, and an agent calling a tool all work against the same named Service instances and their observable state.

This reduces duplicated client, server, and UI mirrors; makes operations inspectable; and gives coding agents stable names and boundaries to reason about. AI First is therefore a state contract, not an AI-specific UI feature.

## Architecture

RAB is composed of small layers with one shared state surface:

- `@rabjs/observer` tracks property dependencies and runs reactions when those dependencies change.
- `@rabjs/service` provides observable `Service` instances, containers, lifecycle management, Actions, and method models such as loading and error state.
- `@rabjs/react` connects Services to React through `observer`, `useService`, and scoped service containers.
- DevTools and Web MCP expose that same container and state surface to inspection, assertions, and agent operations.

The result is one reactive system rather than a UI state model beside an automation state model.

## Quick Start

Use RAB in a React application:

```bash
pnpm add @rabjs/react @rabjs/service
```

`@rabjs/react` re-exports the observer and service APIs, so applications can generally import from that single package. For a guided walkthrough, see the [Quick Start documentation](https://ximing.github.io/rab/#/quick-start).

To work on this repository:

```bash
git clone https://github.com/ximing/rab.git
cd rab
pnpm install
```

## Core Packages

| Package | Responsibility |
| --- | --- |
| [`@rabjs/observer`](./packages/observer) | Fine-grained observable dependency tracking and reactions. |
| [`@rabjs/service`](./packages/service) | Observable Services, dependency containers, lifecycle, actions, and method models. |
| [`@rabjs/react`](./packages/react) | React bindings for reactive rendering and Service resolution. |
| [`@rabjs/devtools`](./packages/devtools) | Inspection and assertion access to the live container tree. |
| [`@rabjs/web-mcp`](./packages/web-mcp) | A WebMCP bridge that exposes active Services as tools for browser agents. |

## The AI-First Workflow

Human and agent operations enter through the same state contract. The UI is one observer of the update, not a separate source of truth:

```text
Human click / Agent tool call
        ↓
Service action or explicit state mutation
        ↓
Observable dependency tracking
        ↓
React UI, DevTools, and assertions observe the same update
```

For example, an agent can discover an active Service, call one of its methods, read its resulting state, and assert the outcome. React observes the very same mutation and rerenders only the components whose dependencies changed. This keeps automation inspectable and avoids synchronizing an additional agent-facing state representation.

## Service Example

This is the minimal React Service pattern:

```tsx
import { Service, bindServices, observer, useService } from "@rabjs/react";

class CounterService extends Service {
  count = 0;

  increment() {
    this.count += 1;
  }
}

const Counter = observer(() => {
  const counter = useService(CounterService);
  return <button onClick={() => counter.increment()}>{counter.count}</button>;
});

export default bindServices(Counter, [CounterService]);
```

Service properties are observable by default, and Service methods are Actions by default. No registration decorator is required for this pattern. `observer` records what the component reads, while `useService` resolves the instance for the current scope. `bindServices` creates a scoped container with lazy singleton resolution, so each bound component tree owns the Services it registers and nested trees can resolve parent Services when needed.

## Observer Example

Use `@rabjs/observer` directly when reactive state is not tied to React:

```ts
import { observable, observe, unobserve } from "@rabjs/observer";

const state = observable({ count: 0 });

const reaction = observe(() => {
  console.log(`count: ${state.count}`);
});

state.count += 1; // Runs the reaction because it read state.count.
unobserve(reaction);
```

Reactions track the properties they read. Changes to those properties rerun the reaction; unrelated changes do not. Read the [Observer guide](https://ximing.github.io/rab/#/guides/observer) for the standalone API and scheduling options.

## Web MCP and DevTools

[`@rabjs/devtools`](./packages/devtools) exposes the live container tree for browser-console inspection and state assertions. It is useful for developers, E2E checks, and CDP-based agent debugging without replacing the runtime state with a snapshot.

[`@rabjs/web-mcp`](./packages/web-mcp) bridges active Service instances to WebMCP tools. A browser agent can discover Services, read state, invoke methods, make permitted state updates, and run assertions; those operations flow through the same observable layer that React renders. See the [DevTools guide](https://ximing.github.io/rab/#/guides/devtools), [AI overview](https://ximing.github.io/rab/#/ai), and [Web MCP guide](https://ximing.github.io/rab/#/ai/web-mcp).

## Repository Structure

```text
rab/
├── packages/
│   ├── observer/       # @rabjs/observer
│   ├── service/        # @rabjs/service
│   ├── react/          # @rabjs/react
│   ├── devtools/       # @rabjs/devtools
│   └── web-mcp/        # @rabjs/web-mcp
├── examples/           # Runnable examples
├── website/            # Documentation site
├── docs/               # Project documentation and assets
└── configs/            # Shared TypeScript and ESLint configuration
```

## Development

RAB is a pnpm workspace powered by Turborepo. Use these repository commands:

```bash
pnpm install
pnpm build
pnpm test:turbo
pnpm --filter @rabjs/website build
```

The last command builds the documentation site independently. During development, `pnpm dev` starts workspace development tasks.

## Documentation

The published documentation is available at [ximing.github.io/rab](https://ximing.github.io/rab/).

- [Quick Start](https://ximing.github.io/rab/#/quick-start)
- [Service containers](https://ximing.github.io/rab/#/guides/service)
- [Observer](https://ximing.github.io/rab/#/guides/observer)
- [Live demos](https://ximing.github.io/rab/#/guides/demos)
- [DevTools](https://ximing.github.io/rab/#/guides/devtools)
- [AI and Web MCP](https://ximing.github.io/rab/#/ai/web-mcp)

## Contributing

Please open an issue or discussion before proposing a large API or architecture change. For a code contribution, create a focused branch, keep Services and their public methods clearly named, add or update tests for behavior changes, and run the relevant build and test commands before opening a pull request. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and update the documentation when public behavior changes.

## License

RAB is released under the [MIT License](https://opensource.org/license/mit/).
