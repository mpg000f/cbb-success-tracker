import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import type { CoachRecord } from '../types'
import { LogoCell } from './LogoCell'

const col = createColumnHelper<CoachRecord>()

const columns = [
  col.accessor('coach', {
    header: 'Coach',
    cell: info => <span className="font-medium">{info.getValue()}</span>,
  }),
  col.accessor('school', {
    header: 'School',
    cell: info => {
      const logos = info.row.original.schoolLogos
      if (logos.length <= 1) {
        return <LogoCell espnId={info.row.original.espnId} name={info.getValue()} />
      }
      return (
        <div className="flex items-center gap-1 flex-wrap">
          {logos.map((l, i) => (
            <img
              key={i}
              src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${l.espnId}.png`}
              alt={l.school}
              title={l.school}
              className="w-6 h-6 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ))}
          <span className="font-medium text-xs ml-1">{logos.map(l => l.school).join(', ')}</span>
        </div>
      )
    },
  }),
  col.accessor('years', { header: 'Years' }),
  col.accessor('wins', { header: 'W' }),
  col.accessor('losses', { header: 'L' }),
  col.accessor('winPct', {
    header: 'Win%',
    cell: info => info.getValue().toFixed(3),
  }),
  col.accessor('tournamentApps', { header: 'NCAA Apps' }),
  col.accessor('sweet16', { header: 'Sweet 16' }),
  col.accessor('elite8', { header: 'Elite 8' }),
  col.accessor('finalFour', { header: 'Final 4' }),
  col.accessor('champGame', { header: 'Title Game' }),
  col.accessor('titles', { header: 'Champs' }),
  col.accessor('confRegularSeason', { header: 'Conf Reg' }),
  col.accessor('confTournament', { header: 'Conf Tourn' }),
]

interface Props {
  data: CoachRecord[]
}

export function CoachTable({ data }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'wins', desc: true }])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  })

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th
                    key={h.id}
                    className="px-3 py-2 cursor-pointer select-none whitespace-nowrap hover:bg-gray-200"
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: ' \u25B2', desc: ' \u25BC' }[h.column.getIsSorted() as string] ?? ''}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-blue-50 even:bg-gray-50">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-3 py-3 text-sm text-gray-600">
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          {' '}({table.getRowCount()} rows)
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1 border rounded disabled:opacity-30 hover:bg-gray-100 cursor-pointer"
          >
            Prev
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1 border rounded disabled:opacity-30 hover:bg-gray-100 cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
