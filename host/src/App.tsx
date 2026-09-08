import { lazy, Suspense, useState } from 'react'
import './repro.css'

const RemoteApp = lazy(() => import('remote/App'))

function App() {
  const [showRemote, setShowRemote] = useState(false)

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Module Federation Vite reproduction</p>
          <h1>Host-owned shared provider without an initial grid route</h1>
          <p className="intro">
            The host declares <code>ag-grid-community</code> as an explicit
            <code> eager: false</code> shared provider. This initial page does
            not render a grid.
          </p>
        </div>
        <span className="status">Host provider</span>
      </header>

      <section className="panel" aria-label="Initial route">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Non-grid route</p>
            <h2>Initial page intentionally has no grid</h2>
          </div>
          <span className="chip">initial</span>
        </div>
        <p className="intro">
          Inspect the generated HTML or browser network panel before loading the
          remote. AG Grid provider chunks should be requested only when the
          remote is resolved.
        </p>
        <button type="button" onClick={() => setShowRemote(true)}>
          Load grid remote
        </button>
      </section>

      {showRemote ? (
      <section className="panel" aria-label="Remote application">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Remote expose</p>
            <h2>Community grid rendered from the remote</h2>
          </div>
          <span className="chip">remote/App</span>
        </div>
        <Suspense fallback={<p className="loading">Loading remote...</p>}>
          <RemoteApp />
        </Suspense>
      </section>
      ) : null}
    </main>
  )
}

export default App
