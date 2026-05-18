import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class BenchmarkErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded border border-rose-700/40 bg-rose-950/20 p-3 text-xs space-y-1.5">
          <p className="font-medium text-rose-200">Benchmark form error</p>
          <p className="text-rose-300 font-mono">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="text-rose-400 underline hover:text-rose-300"
          >
            Dismiss
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
