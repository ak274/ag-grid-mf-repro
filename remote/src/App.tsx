import { useEffect, useRef } from 'react'
import {
  AllCommunityModule,
  type GridApi,
  type GridOptions,
  ModuleRegistry,
  createGrid,
} from 'ag-grid-community'
import './repro.css'

ModuleRegistry.registerModules([AllCommunityModule])

type Row = {
  make: string
  model: string
  price: number
}

const ROWS: Row[] = [
  { make: 'Toyota', model: 'Celica', price: 35_000 },
  { make: 'Ford', model: 'Mondeo', price: 32_000 },
  { make: 'Porsche', model: 'Boxster', price: 72_000 },
]

const GRID_OPTIONS: GridOptions<Row> = {
  rowData: ROWS,
  columnDefs: [
    { field: 'make', headerName: 'Make' },
    { field: 'model', headerName: 'Model' },
    { field: 'price', headerName: 'Price', valueFormatter: ({ value }) => `$${value.toLocaleString()}` },
  ],
  defaultColDef: {
    flex: 1,
    minWidth: 120,
    sortable: true,
    filter: true,
  },
}

function App() {
  const gridElementRef = useRef<HTMLDivElement>(null)
  const gridApiRef = useRef<GridApi<Row> | null>(null)

  useEffect(() => {
    if (!gridElementRef.current) {
      return
    }

    gridApiRef.current = createGrid(gridElementRef.current, GRID_OPTIONS)

    return () => {
      gridApiRef.current?.destroy()
      gridApiRef.current = null
    }
  }, [])

  return (
    <div className="remote-content">
      <div className="remote-copy">
        <p>
          This component imports <code>AllCommunityModule</code>,{' '}
          <code>ModuleRegistry</code>, and <code>createGrid</code> from the
          host-provided shared package.
        </p>
        <span className="badge">remote build target</span>
      </div>
      <div ref={gridElementRef} className="ag-theme-quartz grid" />
    </div>
  )
}

export default App
