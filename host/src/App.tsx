import { lazy, Suspense } from 'react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import './repro.css'

const RemoteApp = lazy(() => import('remote/App'))

ModuleRegistry.registerModules([AllCommunityModule])

function App() {
  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Module Federation Vite reproduction</p>
          <h1>Host provides AG Grid Community</h1>
          <p className="intro">
            The host supplies <code>ag-grid-community</code>. The remote consumes
            it with <code>import: false</code>.
          </p>
        </div>
        <span className="status">Host provider</span>
      </header>

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
    </main>
  )
}

export default App
