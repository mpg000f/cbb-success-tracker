interface Props {
  espnId: number
  name: string
}

export function LogoCell({ espnId, name }: Props) {
  return (
    <div className="flex items-center gap-2">
      <img
        src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`}
        alt={name}
        className="w-8 h-8 object-contain"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
      <span className="font-medium">{name}</span>
    </div>
  )
}
