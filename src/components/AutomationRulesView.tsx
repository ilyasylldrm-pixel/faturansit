import React, { useState, useMemo } from 'react';
import { Play, Plus, CheckCircle2, SlidersHorizontal, Trash2, Tag, Filter, Save } from 'lucide-react';
import {
  AutomationRule,
  FulfillmentStage,
  MarketplaceId,
  SectorType,
  SECTOR_NAMES,
} from '../types/invoicing';

interface AutomationRulesViewProps {
  rules: AutomationRule[];
  onToggleRule: (ruleId: string) => void;
  onDeleteRule: (ruleId: string) => void;
  onAddRule: (newRule: Omit<AutomationRule, 'id' | 'processedCount' | 'lastTriggeredAt'>) => void;
  onRunRulesNow: () => { invoicedCount: number; failedCount: number; logs: string[] };
  onSaveAllModules?: (moduleName?: string) => void;
  hasUnsavedChanges?: boolean;
}

const STAGE_NAMES: Record<FulfillmentStage, string> = {
  SIPARIS_ONAYLANDI: 'Sipariş Onaylandığında',
  HAZIRLANIYOR: 'Sipariş Hazırlanıyor Aşamasında',
  KARGOYA_VERILDI: 'Kargoya Verildiğinde (Barkod Oluşunca)',
  TESLIM_EDILDI: 'Müşteriye Teslim Edildiğinde',
};

const MP_NAMES: Record<MarketplaceId | 'ALL', string> = {
  ALL: 'Tüm Pazaryerleri',
  trendyol: 'Trendyol',
  hepsiburada: 'Hepsiburada',
  amazon: 'Amazon.com.tr',
  n11: 'N11',
  pazarama: 'Pazarama',
  ciceksepeti: 'Çiçeksepeti',
  idefix: 'İdefix',
  pttavm: 'PttAVM',
};

export const AutomationRulesView: React.FC<AutomationRulesViewProps> = ({
  rules,
  onToggleRule,
  onDeleteRule,
  onAddRule,
  onRunRulesNow,
  onSaveAllModules,
  hasUnsavedChanges,
}) => {
  const [name, setName] = useState('');
  const [sector, setSector] = useState<SectorType>('ALL');
  const [marketplace, setMarketplace] = useState<MarketplaceId | 'ALL'>('ALL');
  const [triggerStage, setTriggerStage] = useState<FulfillmentStage>('KARGOYA_VERILDI');
  const [customerScope, setCustomerScope] = useState<'ALL' | 'INDIVIDUAL' | 'CORPORATE'>('ALL');
  const [autoAssignDefaultTckn, setAutoAssignDefaultTckn] = useState(true);
  const [includeShippingLine, setIncludeShippingLine] = useState(true);
  const [corporateScenario, setCorporateScenario] = useState<'TEMELFATURA' | 'TICARIFATURA'>('TICARIFATURA');
  const [sectorFilter, setSectorFilter] = useState<'ALL' | SectorType>('ALL');
  const [formError, setFormError] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const filteredRules = useMemo(() => {
    if (sectorFilter === 'ALL') return rules;
    return rules.filter((r) => (r.sector ?? 'ALL') === sectorFilter || (r.sector ?? 'ALL') === 'ALL');
  }, [rules, sectorFilter]);

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || name.trim().length < 4) {
      setFormError('Lütfen en az 4 karakterli açıklayıcı bir otomasyon kuralı adı girin.');
      return;
    }

    onAddRule({
      name: name.trim(),
      sector,
      marketplace,
      triggerStage,
      customerScope,
      autoAssignDefaultTckn,
      includeShippingLine,
      corporateScenario,
      isActive: true,
    });

    setName('');
    setSector('ALL');
    setLastSummary(`"${name.trim()}" kuralı (${SECTOR_NAMES[sector]}) aktif olarak eklendi.`);
  };

  const handleTriggerEngine = () => {
    const res = onRunRulesNow();
    setExecutionLogs(res.logs);
    setLastSummary(
      `Kural motoru çalıştırıldı: ${res.invoicedCount} sipariş otomatik faturalandırıldı, ${res.failedCount} sipariş doğrulama bekliyor.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Kural Tabanlı Tetikleyiciler · GİB Mükellef Sorgulama & Kargo Yansıtma
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Otomatik Faturalandırma Kuralları
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onSaveAllModules && (
            <button
              type="button"
              onClick={() => onSaveAllModules('Otomasyon Kuralları')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all shadow-xs whitespace-nowrap shrink-0 cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300 ring-offset-1'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{hasUnsavedChanges ? 'Kural Değişikliklerini Kaydet' : 'Kuralları Kaydet'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleTriggerEngine}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Aktif Kuralları Kuyrukta Şimdi Çalıştır
          </button>
        </div>
      </div>

      {lastSummary && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{lastSummary}</span>
          </div>
          {executionLogs.length > 0 && (
            <ul className="text-xs font-mono text-emerald-800 space-y-1 pl-6 list-disc">
              {executionLogs.map((log, i) => (
                <li key={i}>{log}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Active & Inactive Rules List */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-900">
              Tanımlı İş Akışı Kuralları ({filteredRules.length})
            </h2>
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Sektöre göre filtrele"
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value as 'ALL' | SectorType)}
                className="text-xs py-1 px-2 bg-white border border-slate-300 rounded-md text-slate-700"
              >
                <option value="ALL">Filtre: Tüm Sektörler</option>
                {Object.entries(SECTOR_NAMES)
                  .filter(([k]) => k !== 'ALL')
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
            {filteredRules.map((rule, index) => (
              <div
                key={rule.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-semibold text-slate-400">
                      0{index + 1}.
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {rule.name}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      <Tag className="w-3 h-3 text-blue-500" />
                      {SECTOR_NAMES[rule.sector ?? 'ALL']}
                    </span>
                  </div>

                  {/* Unboxed metadata with · separators */}
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-slate-700">
                      {MP_NAMES[rule.marketplace]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{STAGE_NAMES[rule.triggerStage]}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {rule.customerScope === 'ALL'
                        ? 'Bireysel + Kurumsal'
                        : rule.customerScope === 'CORPORATE'
                        ? 'Yalnızca Kurumsal (VKN)'
                        : 'Yalnızca Bireysel (TCKN)'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap font-mono">
                    <span>
                      Senaryo: {rule.corporateScenario}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Kargo Satırı: {rule.includeShippingLine ? 'Dahil (%20 KDV)' : 'Hariç'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      11111111111 TCKN: {rule.autoAssignDefaultTckn ? 'Otomatik' : 'Kapalı'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      İşlenen: {rule.processedCount} belge
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rule.isActive}
                    aria-label={`${rule.name} durumunu değiştir`}
                    onClick={() => onToggleRule(rule.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      rule.isActive
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                        : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {rule.isActive ? 'Aktif' : 'Pasif'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteRule(rule.id)}
                    aria-label={`${rule.name} kuralını sil`}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 cols: New Automation Rule Builder */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-200">
            <SlidersHorizontal className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Yeni Otomasyon Kuralı Tanımla
            </h2>
          </div>

          <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
            <div>
              <label
                htmlFor="rule-name-input"
                className="block font-semibold text-slate-700 mb-1"
              >
                Kural Adı
              </label>
              <input
                id="rule-name-input"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormError(null);
                }}
                placeholder="Örn: Trendyol Gıda Teslim Edilen Siparişlerde e-Arşiv"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-2 focus:outline-blue-600"
              />
            </div>

            {/* Sektör Seçimi */}
            <div>
              <label
                htmlFor="rule-sector-select"
                className="block font-semibold text-slate-700 mb-1"
              >
                Faaliyet Sektörü / Ürün Kategorisi
              </label>
              <select
                id="rule-sector-select"
                value={sector}
                onChange={(e) => setSector(e.target.value as SectorType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-2 focus:outline-blue-600"
              >
                {Object.entries(SECTOR_NAMES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Kuralın yalnızca bu sektör kapsamındaki ürün veya siparişlerde tetiklenmesini sağlar.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="rule-mp-select"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Kapsanan Pazaryeri
                </label>
                <select
                  id="rule-mp-select"
                  value={marketplace}
                  onChange={(e) =>
                    setMarketplace(e.target.value as MarketplaceId | 'ALL')
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="ALL">Tüm Pazaryerleri</option>
                  <option value="trendyol">Trendyol</option>
                  <option value="hepsiburada">Hepsiburada</option>
                  <option value="amazon">Amazon.com.tr</option>
                  <option value="n11">N11</option>
                  <option value="pazarama">Pazarama</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="rule-stage-select"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Tetikleyici Sipariş Durumu
                </label>
                <select
                  id="rule-stage-select"
                  value={triggerStage}
                  onChange={(e) =>
                    setTriggerStage(e.target.value as FulfillmentStage)
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="SIPARIS_ONAYLANDI">Sipariş Onaylandığında</option>
                  <option value="HAZIRLANIYOR">Hazırlanıyor Aşamasında</option>
                  <option value="KARGOYA_VERILDI">Kargoya Verildiğinde</option>
                  <option value="TESLIM_EDILDI">Teslim Edildiğinde</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="rule-scope-select"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Müşteri Mükellef Grubu
                </label>
                <select
                  id="rule-scope-select"
                  value={customerScope}
                  onChange={(e) =>
                    setCustomerScope(
                      e.target.value as 'ALL' | 'INDIVIDUAL' | 'CORPORATE'
                    )
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="ALL">Tümü (Bireysel + Kurumsal)</option>
                  <option value="INDIVIDUAL">Yalnızca Bireysel (e-Arşiv)</option>
                  <option value="CORPORATE">Yalnızca Kurumsal (e-Fatura)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="rule-scenario-select"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Kurumsal e-Fatura Senaryosu
                </label>
                <select
                  id="rule-scenario-select"
                  value={corporateScenario}
                  onChange={(e) =>
                    setCorporateScenario(
                      e.target.value as 'TEMELFATURA' | 'TICARIFATURA'
                    )
                  }
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="TICARIFATURA">TICARIFATURA</option>
                  <option value="TEMELFATURA">TEMELFATURA</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAssignDefaultTckn}
                  onChange={(e) => setAutoAssignDefaultTckn(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>
                  Bireysel siparişlerde eksik TCKN varsa otomatik <strong className="font-mono">11111111111</strong> ata
                </span>
              </label>

              <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeShippingLine}
                  onChange={(e) => setIncludeShippingLine(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>
                  Pazaryeri kargo hizmet bedelini faturaya ayrı satır olarak ekle (%20 KDV)
                </span>
              </label>
            </div>

            {formError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 font-medium">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={!name.trim()}
              className={`w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
                name.trim()
                  ? 'text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-xs'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Otomasyon Kuralını Kaydet ve Etkinleştir
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
