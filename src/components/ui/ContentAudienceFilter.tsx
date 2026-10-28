import { Users, Heart } from 'lucide-react';

export type ContentAudienceFilter = 'realm' | 'relationship';

interface ContentAudienceFilterProps {
  value: ContentAudienceFilter;
  onChange: (value: ContentAudienceFilter) => void;
}

const options: { value: ContentAudienceFilter; label: string; Icon: typeof Users }[] = [
  { value: 'realm', label: 'Grupo', Icon: Users },
  { value: 'relationship', label: 'Pareja', Icon: Heart },
];

export default function ContentAudienceFilter({ value, onChange }: ContentAudienceFilterProps) {
  return (
    <div role="group" aria-label="Filtrar contenido por audiencia" className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
      {options.map(({ value: option, label, Icon }) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
            value === option
              ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-md'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
