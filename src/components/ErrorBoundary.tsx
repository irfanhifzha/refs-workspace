import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { recordError } from '../lib/telemetry'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordError(error, { kind: 'boundary', detail: info.componentStack ?? undefined })
    console.error('Unexpected UI error', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="state error" role="alert">
          <p>Something broke while rendering this page.</p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
