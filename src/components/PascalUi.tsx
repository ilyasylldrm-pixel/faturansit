import React from 'react';
import {
  FileSpreadsheet,
  FileText,
  Mail,
  Save,
  Plus,
} from 'lucide-react';

/**
 * 3D Isometric Cube & Geometric Lattice Illustration
 * Matches the left side of the Hero Banner in the uploaded reference screenshot.
 */
export const IsometricCubeGraphic: React.FC = () => (
  <svg
    viewBox="0 0 220 140"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-48 h-32 pointer-events-none select-none opacity-90"
    aria-hidden="true"
  >
    {/* Background Isometric Wireframe Grid */}
    <path
      d="M10 95 L110 25 L210 95 M30 115 L130 45 M50 130 L150 60 M10 45 L110 115 M35 30 L135 100"
      stroke="#0284C7"
      strokeOpacity="0.14"
      strokeWidth="1"
    />
    {/* Outer Translucent Circle */}
    <circle
      cx="98"
      cy="74"
      r="46"
      fill="url(#heroCircleGrad)"
      fillOpacity="0.45"
    />
    {/* 3D Isometric Cube - Top Face */}
    <polygon
      points="95,28 135,48 95,68 55,48"
      fill="#BAE6FD"
      fillOpacity="0.75"
      stroke="#38BDF8"
      strokeWidth="1.2"
    />
    {/* 3D Isometric Cube - Left Face */}
    <polygon
      points="55,48 95,68 95,112 55,92"
      fill="#7DD3FC"
      fillOpacity="0.65"
      stroke="#0284C7"
      strokeOpacity="0.45"
      strokeWidth="1.2"
    />
    {/* 3D Isometric Cube - Right Face */}
    <polygon
      points="95,68 135,48 135,92 95,112"
      fill="#38BDF8"
      fillOpacity="0.45"
      stroke="#0284C7"
      strokeOpacity="0.45"
      strokeWidth="1.2"
    />
    {/* Inner Dashed Cube Edges */}
    <line
      x1="95"
      y1="28"
      x2="95"
      y2="72"
      stroke="#0369A1"
      strokeOpacity="0.3"
      strokeDasharray="3 3"
    />
    <line
      x1="55"
      y1="92"
      x2="95"
      y2="72"
      stroke="#0369A1"
      strokeOpacity="0.3"
      strokeDasharray="3 3"
    />
    <line
      x1="135"
      y1="92"
      x2="95"
      y2="72"
      stroke="#0369A1"
      strokeOpacity="0.3"
      strokeDasharray="3 3"
    />
    {/* Floating Accent Spheres & Crosshairs */}
    <circle cx="132" cy="24" r="4" fill="#0284C7" fillOpacity="0.45" />
    <circle cx="156" cy="40" r="2.5" fill="#0284C7" fillOpacity="0.35" />
    <circle cx="38" cy="64" r="3" fill="#0284C7" fillOpacity="0.3" />
    {/* Plus Crosshairs (+) */}
    <path
      d="M22 86 H30 M26 82 V90 M176 58 H184 M180 54 V62 M152 88 H158 M155 85 V91"
      stroke="#0369A1"
      strokeOpacity="0.4"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    <defs>
      <linearGradient
        id="heroCircleGrad"
        x1="52"
        y1="28"
        x2="144"
        y2="120"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#38BDF8" stopOpacity="0.4" />
        <stop offset="1" stopColor="#0284C7" stopOpacity="0.08" />
      </linearGradient>
    </defs>
  </svg>
);

export interface PascalHeroBannerProps {
  kicker: string;
  title: string;
  subtitle: string;
  onExportExcel?: () => void;
  excelLabel?: string;
  onExportPdf?: () => void;
  pdfLabel?: string;
  onEmailAction?: () => void;
  emailLabel?: string;
  onSaveAction?: () => void;
  saveLabel?: string;
  hasUnsavedChanges?: boolean;
  onPrimaryAction?: () => void;
  primaryLabel?: string;
  extraActions?: React.ReactNode;
}

export const PascalHeroBanner: React.FC<PascalHeroBannerProps> = ({
  kicker,
  title,
  subtitle,
  onExportExcel,
  excelLabel = 'Excel İndir',
  onExportPdf,
  pdfLabel = 'PDF İndir',
  onEmailAction,
  emailLabel = 'E-Posta',
  onSaveAction,
  saveLabel = 'Kaydet',
  hasUnsavedChanges = false,
  onPrimaryAction,
  primaryLabel,
  extraActions,
}) => {
  return (
    <div className="pattern-hero-banner rounded-2xl border border-[#CBE0F5] px-6 py-5 relative overflow-hidden shadow-2xs">
      {/* Decorative 3D Isometric Cube on the Left */}
      <div className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
        <IsometricCubeGraphic />
      </div>

      <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:pl-44">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/85 border border-sky-200/80 text-[10.5px] font-bold uppercase tracking-wider text-[#0077CC] shadow-2xs">
            <span>✦</span>
            <span>{kicker}</span>
          </div>
          <h2 className="font-serif-display text-[28px] sm:text-[31px] font-semibold text-slate-900 mt-1.5 leading-[1.15]">
            {title}
          </h2>
          <p className="text-[13px] font-normal text-slate-600 mt-1 max-w-2xl">
            {subtitle}
          </p>
        </div>

        {/* Right-side Action Pills matching Screenshot */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/90 text-[12.5px] font-semibold transition-all cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{excelLabel}</span>
            </button>
          )}

          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/90 text-[12.5px] font-semibold transition-all cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>{pdfLabel}</span>
            </button>
          )}

          {onEmailAction && (
            <button
              type="button"
              onClick={onEmailAction}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50/90 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/90 text-[12.5px] font-semibold transition-all cursor-pointer shadow-2xs"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-600" />
              <span>{emailLabel}</span>
            </button>
          )}

          {extraActions}

          {onSaveAction && (
            <button
              type="button"
              onClick={onSaveAction}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-semibold border transition-all cursor-pointer shadow-2xs ${
                hasUnsavedChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 ring-2 ring-emerald-300'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveLabel}</span>
            </button>
          )}

          {onPrimaryAction && primaryLabel && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B5FA5] hover:bg-[#084B83] text-white text-[12.5px] font-semibold transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{primaryLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export interface PascalKpiCardProps {
  title: string;
  value: string | number;
  pillText: string;
  subtitle: string;
  tone: 'emerald' | 'rose' | 'amber' | 'sky';
  icon: React.ReactNode;
  testId?: string;
}

export const PascalKpiCard: React.FC<PascalKpiCardProps> = ({
  title,
  value,
  pillText,
  subtitle,
  tone,
  icon,
  testId,
}) => {
  const toneStyles = {
    emerald: {
      valueText: 'text-emerald-600',
      iconBox: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    rose: {
      valueText: 'text-rose-600',
      iconBox: 'bg-rose-50 text-rose-600 border-rose-100',
      pill: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    amber: {
      valueText: 'text-amber-500',
      iconBox: 'bg-amber-50 text-amber-600 border-amber-100',
      pill: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    sky: {
      valueText: 'text-slate-800',
      iconBox: 'bg-sky-50 text-sky-700 border-sky-100',
      pill: 'bg-sky-50 text-sky-700 border-sky-200',
    },
  }[tone];

  return (
    <div className="pattern-diamond-lattice bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-slate-600">{title}</p>
          <p
            data-testid={testId}
            className={`text-[23px] font-semibold font-mono tabular-nums mt-1.5 tracking-tight ${toneStyles.valueText}`}
          >
            {value}
          </p>
        </div>
        <div
          className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${toneStyles.iconBox}`}
        >
          {icon}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-1">
        <span
          className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${toneStyles.pill}`}
        >
          {pillText}
        </span>
        <span className="text-[12px] font-normal text-slate-500 truncate">{subtitle}</span>
      </div>
    </div>
  );
};
