import type { ViewMode } from '../types'

interface Props {
  view: ViewMode
  setView: (v: ViewMode) => void
}

const tabs: { key: ViewMode; label: string }[] = [
  { key: 'schools', label: 'Schools' },
  { key: 'coaches', label: 'Coaches' },
  { key: 'compare', label: 'Compare' },
  { key: 'similar', label: 'Find Similar' },
]

export function Header({ view, setView }: Props) {
  return (
    <header className="bg-blue-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">College Basketball Success Tracker</h1>
        <nav className="flex gap-1 bg-blue-800 rounded-lg p-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                view === t.key ? 'bg-white text-blue-900' : 'text-blue-200 hover:text-white hover:bg-blue-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
