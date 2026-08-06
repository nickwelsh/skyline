export function BrandMark({ name }: { name: string }) {
  return <span className="grid size-5 shrink-0 place-items-center overflow-hidden rounded-[10%] bg-amber-400 text-xs font-bold leading-none text-charcoal-950">{name.slice(0, 2)}</span>;
}
