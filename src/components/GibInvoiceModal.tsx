import React, { useState, useEffect } from 'react';
import { X, Printer, Download, FileCode, FileText, CheckCircle2 } from 'lucide-react';
import { MarketplaceOrder } from '../types/invoicing';
import {
  calculateOrderTotals,
  formatTryCurrency,
  formatTurkishAmountInWords,
  generateDeterministicEttn,
  generateUblTrXmlPreview,
  roundCurrency,
} from '../utils/invoicingEngine';

interface GibInvoiceModalProps {
  order: MarketplaceOrder | null;
  onClose: () => void;
}

export const GibInvoiceModal: React.FC<GibInvoiceModalProps> = ({
  order,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'visual' | 'xml'>('visual');
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [order, onClose]);

  if (!order) return null;

  const financials = calculateOrderTotals(
    order.items,
    order.shippingFeeVatIncluded,
    order.includeShippingInInvoice,
    order.sellerDiscountTotal,
    order.marketplaceCommissionRate,
    order.withholdingRate
  );

  const invoiceNumber = order.gibInvoiceNumber ?? 'TASLAK2026000000001';
  const ettn = order.ettn ?? generateDeterministicEttn(order.id, 1);
  const docTitle =
    order.documentType === 'E_FATURA' ||
    (order.customerType === 'CORPORATE' && order.isEFaturaRegistered)
      ? 'e-FATURA'
      : 'e-ARŞİV FATURA';
  const scenario =
    order.scenario ??
    (order.customerType === 'CORPORATE' && order.isEFaturaRegistered
      ? 'TICARIFATURA'
      : 'EARSIVFATURA');

  const xmlContent = generateUblTrXmlPreview(order);
  const amountInWords = formatTurkishAmountInWords(financials.grossInvoiceTotal);

  const handleDownloadXml = () => {
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoiceNumber}-UBL-TR21.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCopiedNotice('UBL-TR 2.1 XML dosyası indirildi.');
    setTimeout(() => setCopiedNotice(null), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gib-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden my-4">
        {/* Modal Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 bg-slate-50 border-b border-slate-200 text-slate-800">
          <div className="flex items-center gap-3">
            <h2 id="gib-modal-title" className="text-sm font-semibold tracking-tight text-slate-900">
              GİB Resmi e-Belge Önizleme · <span className="font-mono text-[#0F6BAE] font-bold">{invoiceNumber}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('visual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'visual'
                    ? 'bg-[#248BD6] text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-white" />
                GİB Görsel Fatura
              </button>
              <button
                type="button"
                onClick={() => setViewMode('xml')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'xml'
                    ? 'bg-[#248BD6] text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-white" />
                UBL-TR 2.1 XML
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadXml}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#248BD6]" />
              XML İndir
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0F6BAE] hover:bg-[#248BD6] text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Yazdır / PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fatura önizlemeyi kapat"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {copiedNotice && (
          <div className="flex items-center gap-2 px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{copiedNotice}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 max-h-[84vh] overflow-y-auto bg-slate-50">
          {viewMode === 'xml' ? (
            <div className="bg-slate-900 text-slate-100 p-5 rounded-lg border border-slate-800 overflow-x-auto">
              <pre className="text-xs font-mono leading-relaxed">{xmlContent}</pre>
            </div>
          ) : (
            <div className="gib-paper bg-white border border-slate-300 p-6 text-slate-900 shadow-xs">
              {/* Official GİB 3-Column Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b-2 border-slate-900">
                {/* Left: Seller Info */}
                <div className="text-xs space-y-1">
                  <p className="font-bold text-sm text-slate-900">
                    ANADOLU DİJİTAL TİCARET VE LOJİSTİK A.Ş.
                  </p>
                  <p className="text-slate-600">
                    Maslak Mah. Büyükdere Cad. Teknoloji Plaza No: 245 Sarıyer / İstanbul
                  </p>
                  <p className="text-slate-700">
                    <span className="font-semibold">Vergi Dairesi:</span> Maslak V.D.
                  </p>
                  <p className="text-slate-700 font-mono">
                    <span className="font-sans font-semibold">VKN:</span> 3890642158
                  </p>
                  <p className="text-slate-600 font-mono">
                    <span className="font-sans font-semibold">MERSİS:</span> 0389064215800019
                  </p>
                </div>

                {/* Center: GİB Emblem & Document Title */}
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-full border-2 border-red-700 flex flex-col items-center justify-center text-red-700 font-bold leading-none mb-2">
                    <span className="text-[10px] tracking-wider">T.C.</span>
                    <span className="text-xs font-extrabold">GİB</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600">
                    T.C. Hazine ve Maliye Bakanlığı
                  </p>
                  <p className="text-base font-bold tracking-tight text-slate-900 mt-0.5">
                    {docTitle}
                  </p>
                </div>

                {/* Right: QR + Metadata Table */}
                <div className="flex flex-col items-end justify-between gap-3">
                  {/* Deterministic SVG QR Code Representation */}
                  <div className="flex items-center gap-3">
                    <div
                      aria-label="GİB e-Belge Karekod"
                      className="w-16 h-16 p-1 border border-slate-300 bg-white grid grid-cols-5 grid-rows-5 gap-0.5"
                    >
                      {Array.from({ length: 25 }).map((_, i) => {
                        const filled = (i * 7 + invoiceNumber.charCodeAt(i % 8)) % 2 === 0;
                        return (
                          <div
                            key={i}
                            className={filled ? 'bg-slate-900' : 'bg-white'}
                          />
                        );
                      })}
                    </div>
                    <table className="text-[11px] border-collapse border border-slate-300">
                      <tbody>
                        <tr className="border-b border-slate-300">
                          <th className="px-2 py-1 text-left bg-slate-100 font-semibold">
                            Özelleştirme No
                          </th>
                          <td className="px-2 py-1 font-mono">TR1.2</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                          <th className="px-2 py-1 text-left bg-slate-100 font-semibold">
                            Senaryo
                          </th>
                          <td className="px-2 py-1 font-mono">{scenario}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                          <th className="px-2 py-1 text-left bg-slate-100 font-semibold">
                            Fatura Tipi
                          </th>
                          <td className="px-2 py-1 font-mono">SATIS</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                          <th className="px-2 py-1 text-left bg-slate-100 font-semibold">
                            Fatura No
                          </th>
                          <td className="px-2 py-1 font-mono font-bold text-slate-900">
                            {invoiceNumber}
                          </td>
                        </tr>
                        <tr>
                          <th className="px-2 py-1 text-left bg-slate-100 font-semibold">
                            Düzenleme Tarihi
                          </th>
                          <td className="px-2 py-1 font-mono">
                            {order.invoicedAt ?? order.orderDate}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Buyer & Marketplace Metadata Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 border-b border-slate-300 text-xs">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1">SAYIN (ALICI BİLGİLERİ)</p>
                  <p className="font-bold text-sm text-slate-900">{order.customerName}</p>
                  <p className="text-slate-600 mt-0.5">
                    {order.address} · {order.district} / {order.city}
                  </p>
                  <p className="text-slate-700 mt-1 font-mono">
                    <span className="font-sans font-semibold">
                      {order.customerType === 'CORPORATE' ? 'VKN:' : 'TCKN:'}
                    </span>{' '}
                    {order.taxIdentifier || '11111111111 (Nihai Tüketici)'}
                    {order.taxOffice ? ` · Vergi Dairesi: ${order.taxOffice}` : ''}
                  </p>
                  <p className="text-slate-600 mt-0.5">E-Posta: {order.email}</p>
                </div>

                <div className="md:text-right space-y-1">
                  <p className="text-[11px] font-bold text-slate-500">PAZARYERİ & LOJİSTİK BİLGİLERİ</p>
                  <p className="text-slate-800">
                    <span className="font-semibold">Aracı Hizmet Sağlayıcı (Pazaryeri):</span>{' '}
                    {order.marketplace.toUpperCase()} ({order.storeName})
                  </p>
                  <p className="text-slate-800 font-mono">
                    <span className="font-sans font-semibold">Sipariş Numarası:</span> #
                    {order.marketplaceOrderNumber}
                  </p>
                  <p className="text-slate-800">
                    <span className="font-semibold">Kargo Firması & Kampanya Kodu:</span>{' '}
                    {order.cargoCarrier} · <span className="font-mono">{order.cargoTrackingCode}</span>
                  </p>
                  <p className="text-slate-600 font-mono text-[11px]">
                    <span className="font-sans font-semibold">ETTN:</span> {ettn}
                  </p>
                </div>
              </div>

              {/* Invoice Line Items Table */}
              <div className="my-5 overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                      <th className="py-2 px-2.5 text-left font-semibold border-r border-slate-300">
                        Sıra
                      </th>
                      <th className="py-2 px-2.5 text-left font-semibold border-r border-slate-300">
                        Stok Kodu (SKU)
                      </th>
                      <th className="py-2 px-2.5 text-left font-semibold border-r border-slate-300">
                        Mal / Hizmet Açıklaması
                      </th>
                      <th className="py-2 px-2.5 text-right font-semibold border-r border-slate-300">
                        Miktar
                      </th>
                      <th className="py-2 px-2.5 text-right font-semibold border-r border-slate-300">
                        Birim Fiyat (KDV Hariç)
                      </th>
                      <th className="py-2 px-2.5 text-right font-semibold border-r border-slate-300">
                        KDV Oranı
                      </th>
                      <th className="py-2 px-2.5 text-right font-semibold border-r border-slate-300">
                        KDV Tutarı
                      </th>
                      <th className="py-2 px-2.5 text-right font-semibold">
                        Mal / Hizmet Tutarı (KDV Dahil)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, idx) => {
                      const lineGross = roundCurrency(
                        item.quantity * item.unitPriceVatIncluded
                      );
                      const lineBase = roundCurrency(
                        lineGross / (1 + item.vatRate / 100)
                      );
                      const unitExcl = roundCurrency(lineBase / item.quantity);
                      const lineVat = roundCurrency(lineGross - lineBase);
                      return (
                        <tr key={item.id} className="border-b border-slate-200">
                          <td className="py-2 px-2.5 font-mono border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-slate-700 border-r border-slate-200">
                            {item.sku}
                          </td>
                          <td className="py-2 px-2.5 text-slate-900 font-medium border-r border-slate-200">
                            {item.title}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">
                            {item.quantity} Adet
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">
                            {formatTryCurrency(unitExcl)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">
                            %{item.vatRate}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">
                            {formatTryCurrency(lineVat)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-900">
                            {formatTryCurrency(lineGross)}
                          </td>
                        </tr>
                      );
                    })}

                    {order.includeShippingInInvoice && order.shippingFeeVatIncluded > 0 && (
                      <tr className="border-b border-slate-200 bg-slate-50/60">
                        <td className="py-2 px-2.5 font-mono border-r border-slate-200">
                          {order.items.length + 1}
                        </td>
                        <td className="py-2 px-2.5 font-mono text-slate-700 border-r border-slate-200">
                          KRG-HIZMET
                        </td>
                        <td className="py-2 px-2.5 text-slate-900 font-medium border-r border-slate-200">
                          Kargo ve Taşıma Hizmet Bedeli ({order.cargoCarrier})
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">
                          1 Adet
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">
                          {formatTryCurrency(roundCurrency(order.shippingFeeVatIncluded / 1.2))}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">
                          %20
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">
                          {formatTryCurrency(
                            roundCurrency(
                              order.shippingFeeVatIncluded -
                                order.shippingFeeVatIncluded / 1.2
                            )
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-900">
                          {formatTryCurrency(order.shippingFeeVatIncluded)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals & Notes Section */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                <div className="md:col-span-7 text-xs space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-sm">
                  <p className="font-mono font-bold text-slate-900">
                    Yazıyla: {amountInWords}
                  </p>
                  {order.orderNote && order.orderNote.trim() ? (
                    <div className="pt-2 border-t border-slate-200 space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Fatura Notu:
                      </span>
                      <p className="text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                        {order.orderNote.trim()}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="md:col-span-5">
                  <table className="w-full text-xs border-collapse border border-slate-300">
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <th className="py-1.5 px-3 text-left bg-slate-100 font-medium text-slate-700">
                          Mal / Hizmet Toplam Tutarı (Matrah)
                        </th>
                        <td className="py-1.5 px-3 text-right font-mono">
                          {formatTryCurrency(financials.subtotalExclVat)}
                        </td>
                      </tr>
                      {order.sellerDiscountTotal > 0 && (
                        <tr className="border-b border-slate-200">
                          <th className="py-1.5 px-3 text-left bg-slate-100 font-medium text-slate-700">
                            Satıcı İskonto Toplamı
                          </th>
                          <td className="py-1.5 px-3 text-right font-mono text-amber-700">
                            -{formatTryCurrency(order.sellerDiscountTotal)}
                          </td>
                        </tr>
                      )}
                      {financials.vatBreakdown.rate1.tax > 0 && (
                        <tr className="border-b border-slate-200">
                          <th className="py-1.5 px-3 text-left bg-slate-100 font-medium text-slate-700">
                            Hesaplanan KDV (%1)
                          </th>
                          <td className="py-1.5 px-3 text-right font-mono">
                            {formatTryCurrency(financials.vatBreakdown.rate1.tax)}
                          </td>
                        </tr>
                      )}
                      {financials.vatBreakdown.rate10.tax > 0 && (
                        <tr className="border-b border-slate-200">
                          <th className="py-1.5 px-3 text-left bg-slate-100 font-medium text-slate-700">
                            Hesaplanan KDV (%10)
                          </th>
                          <td className="py-1.5 px-3 text-right font-mono">
                            {formatTryCurrency(financials.vatBreakdown.rate10.tax)}
                          </td>
                        </tr>
                      )}
                      {financials.vatBreakdown.rate20.tax > 0 && (
                        <tr className="border-b border-slate-200">
                          <th className="py-1.5 px-3 text-left bg-slate-100 font-medium text-slate-700">
                            Hesaplanan KDV (%20)
                          </th>
                          <td className="py-1.5 px-3 text-right font-mono">
                            {formatTryCurrency(financials.vatBreakdown.rate20.tax)}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-slate-300 bg-slate-50">
                        <th className="py-1.5 px-3 text-left font-semibold text-slate-800">
                          Toplam KDV
                        </th>
                        <td className="py-1.5 px-3 text-right font-mono font-semibold">
                          {formatTryCurrency(financials.totalVat)}
                        </td>
                      </tr>
                      <tr className="bg-slate-900 text-white">
                        <th className="py-2 px-3 text-left font-bold">
                          Ödenecek Toplam Tutar
                        </th>
                        <td className="py-2 px-3 text-right font-mono font-bold text-sm">
                          {formatTryCurrency(financials.grossInvoiceTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
