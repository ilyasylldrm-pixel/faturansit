import React, { useState } from 'react';
import { Download, Calculator, CheckCircle2 } from 'lucide-react';
import {
  MarketplaceIntegration,
  MarketplaceOrder,
  VatRate,
} from '../types/invoicing';
import {
  calculateOrderTotals,
  computeTaxAndCommissionReport,
  formatTryCurrency,
} from '../utils/invoicingEngine';

interface TaxReconciliationViewProps {
  orders: MarketplaceOrder[];
  integrations: MarketplaceIntegration[];
}

export const TaxReconciliationView: React.FC<TaxReconciliationViewProps> = ({
  orders,
  integrations,
}) => {
  const report = computeTaxAndCommissionReport(orders, integrations);

  // Interactive Calculator State
  const [calcGrossPrice, setCalcGrossPrice] = useState('3600');
  const [calcVatRate, setCalcVatRate] = useState<VatRate>(20);
  const [calcShippingFee, setCalcShippingFee] = useState('60');
  const [calcIncludeShipping, setCalcIncludeShipping] = useState(true);
  const [calcCommissionRate, setCalcCommissionRate] = useState('16.5');
  const [csvDownloaded, setCsvDownloaded] = useState(false);

  const simulatedTotals = calculateOrderTotals(
    [
      {
        id: 'sim-1',
        sku: 'SIM-SKU',
        title: 'Simülasyon Ürünü',
        quantity: 1,
        unitPriceVatIncluded: Math.max(0, Number(calcGrossPrice) || 0),
        vatRate: calcVatRate,
      },
    ],
    Math.max(0, Number(calcShippingFee) || 0),
    calcIncludeShipping,
    0,
    Math.min(100, Math.max(0, Number(calcCommissionRate) || 0)),
    1
  );

  const handleExportCsv = () => {
    const headers = [
      'Pazaryeri',
      'Siparis Adedi',
      'Kesilen e-Belge',
      'Brut Fatura Tutari (TL)',
      'Hesaplanan KDV (TL)',
      'Pazaryeri Komisyonu (TL)',
      'E-Ticaret Stopaji %1 (TL)',
      'Net Hakedis (TL)',
    ];
    const rows = report.byMarketplace.map((m) => [
      m.name,
      m.orderCount,
      m.invoicedCount,
      m.grossSales.toFixed(2),
      m.vatTotal.toFixed(2),
      m.commissionAmount.toFixed(2),
      m.withholdingAmount.toFixed(2),
      m.netPayout.toFixed(2),
    ]);

    const csvString = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'faturansit-kdv-komisyon-mutabakat-2026.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCsvDownloaded(true);
    setTimeout(() => setCsvDownloaded(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            KDV Beyanname Hazırlığı (%1, %10, %20) · Pazaryeri Komisyon & %1 E-Ticaret Stopajı Özeti
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            KDV Beyan ve Pazaryeri Komisyon Mutabakatı
          </h1>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Mutabakat Raporunu İndir (CSV)
        </button>
      </div>

      {csvDownloaded && (
        <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Resmi muhasebe uyumlu KDV ve Pazaryeri Komisyon Mutabakat CSV tablosu indirildi.
          </span>
        </div>
      )}

      {/* 4 Financial Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs font-medium text-slate-500">KDV Hariç Net Matrah</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {formatTryCurrency(report.totalMatrah)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Toplam satış matrahı
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs font-medium text-slate-500">Hesaplanan Toplam KDV</p>
          <p className="text-2xl font-bold text-blue-700 font-mono tabular-nums mt-1">
            {formatTryCurrency(report.totalVat)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            %1, %10 ve %20 dilimler toplamı
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs font-medium text-slate-500">
            Pazaryeri Komisyon & %1 Stopaj
          </p>
          <p className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
            {formatTryCurrency(report.totalCommissionCut + report.totalWithholdingCut)}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            Stopaj: {formatTryCurrency(report.totalWithholdingCut)}
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs font-medium text-slate-500">
            Net Tahsil Edilecek Hakediş
          </p>
          <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {formatTryCurrency(report.totalNetPayout)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Komisyon ve stopaj düşülmüş net tutar
          </p>
        </div>
      </div>

      {/* Main Split: Left 7 cols Marketplace Reconciliation & VAT Breakdown, Right 5 cols Live Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          {/* VAT Rate Breakdown Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-900">
                KDV Oranlarına Göre Matrah ve Vergi Dağılımı
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50/50">
                    <th className="py-2.5 px-4 font-semibold">KDV Oranı Dilimi</th>
                    <th className="py-2.5 px-4 text-right font-semibold">KDV Matrahı</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Hesaplanan KDV</th>
                    <th className="py-2.5 px-4 text-right font-semibold">KDV Dahil Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-900">
                      %1 KDV (Temel Gıda & Tarım Ürünleri)
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {formatTryCurrency(report.vatByRate.rate1.base)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-blue-700">
                      {formatTryCurrency(report.vatByRate.rate1.tax)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold">
                      {formatTryCurrency(report.vatByRate.rate1.gross)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-900">
                      %10 KDV (Tekstil, Giyim, Kitap & Ev Tekstili)
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {formatTryCurrency(report.vatByRate.rate10.base)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-blue-700">
                      {formatTryCurrency(report.vatByRate.rate10.tax)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold">
                      {formatTryCurrency(report.vatByRate.rate10.gross)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-900">
                      %20 KDV (Elektronik, Donanım & Kargo Hizmeti)
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {formatTryCurrency(report.vatByRate.rate20.base)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-blue-700">
                      {formatTryCurrency(report.vatByRate.rate20.tax)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold">
                      {formatTryCurrency(report.vatByRate.rate20.gross)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Marketplace Commission & Payout Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-900">
                Pazaryeri Bazlı Satış, Komisyon ve Net Hakediş Mutabakatı
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50/50">
                    <th className="py-2.5 px-4 font-semibold">Pazaryeri</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Belge</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Brüt Fatura</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Komisyon Kesintisi</th>
                    <th className="py-2.5 px-3 text-right font-semibold">%1 Stopaj</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Net Hakediş</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                  {report.byMarketplace.map((row) => (
                    <tr key={row.marketplace} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-sans font-medium text-slate-900">
                        {row.name}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {row.invoicedCount}/{row.orderCount}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-900">
                        {formatTryCurrency(row.grossSales)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-700">
                        -{formatTryCurrency(row.commissionAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        -{formatTryCurrency(row.withholdingAmount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">
                        {formatTryCurrency(row.netPayout)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 5 cols: Interactive Invoice & Marketplace Margin Calculator */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Calculator className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Canlı Fatura KDV, Stopaj ve Hakediş Hesaplayıcı
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="calc-gross-input"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Satış Fiyatı (KDV Dahil TL)
                </label>
                <input
                  id="calc-gross-input"
                  type="number"
                  step="10"
                  value={calcGrossPrice}
                  onChange={(e) => setCalcGrossPrice(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="calc-vat-select"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Ürün KDV Oranı
                </label>
                <select
                  id="calc-vat-select"
                  value={calcVatRate}
                  onChange={(e) => setCalcVatRate(Number(e.target.value) as VatRate)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value={20}>%20 KDV</option>
                  <option value={10}>%10 KDV</option>
                  <option value={1}>%1 KDV</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="calc-comm-input"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Pazaryeri Komisyonu (%)
                </label>
                <input
                  id="calc-comm-input"
                  type="number"
                  step="0.5"
                  value={calcCommissionRate}
                  onChange={(e) => setCalcCommissionRate(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="calc-ship-input"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Kargo Hizmet Bedeli (TL)
                </label>
                <input
                  id="calc-ship-input"
                  type="number"
                  step="5"
                  value={calcShippingFee}
                  onChange={(e) => setCalcShippingFee(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={calcIncludeShipping}
                onChange={(e) => setCalcIncludeShipping(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>Kargo ücretini alıcı faturasına dahil et (%20 KDV)</span>
            </label>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs font-mono tabular-nums">
            <div className="flex justify-between text-slate-600">
              <span className="font-sans">KDV Hariç Fatura Matrahı:</span>
              <span>{formatTryCurrency(simulatedTotals.subtotalExclVat)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span className="font-sans">Hesaplanan KDV Toplamı:</span>
              <span>{formatTryCurrency(simulatedTotals.totalVat)}</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-900 pt-1 border-t border-slate-200">
              <span className="font-sans">GİB Fatura Genel Toplamı:</span>
              <span>{formatTryCurrency(simulatedTotals.grossInvoiceTotal)}</span>
            </div>
            <div className="flex justify-between text-amber-700">
              <span className="font-sans">Pazaryeri Komisyon Kesintisi:</span>
              <span>-{formatTryCurrency(simulatedTotals.marketplaceCommissionAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span className="font-sans">E-Ticaret Stopajı (%1 Matrah):</span>
              <span>-{formatTryCurrency(simulatedTotals.withholdingTaxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-emerald-700 pt-2 border-t border-slate-300">
              <span className="font-sans">Mağaza Net Hakediş Tutarı:</span>
              <span>{formatTryCurrency(simulatedTotals.netSellerPayout)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
