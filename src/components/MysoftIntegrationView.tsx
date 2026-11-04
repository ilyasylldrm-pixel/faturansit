import React, { useState } from 'react';
import {
  IncomingInvoice,
  MysoftApiConfig,
  MysoftCreditLog,
  MysoftInvoiceStatusRecord,
  MysoftTaxpayerLookupResult,
} from '../types/invoicing';
import {
  cancelMysoftEArchiveInvoice,
  queryMysoftTaxpayer,
  respondToIncomingInvoice,
  syncMysoftInvoiceStatuses,
  testMysoftConnection,
  topUpMysoftCredits,
} from '../utils/mysoftService';

interface MysoftIntegrationViewProps {
  initialConfig?: MysoftApiConfig;
  statusRecords: MysoftInvoiceStatusRecord[];
  incomingInvoices: IncomingInvoice[];
  creditLogs: MysoftCreditLog[];
  onConfigSave?: (newConfig: MysoftApiConfig) => void;
  onRecordsChange?: (records: MysoftInvoiceStatusRecord[]) => void;
  onIncomingChange?: (invoices: IncomingInvoice[]) => void;
  onCreditLogsChange?: (logs: MysoftCreditLog[], newBalance: number) => void;
}

export const MysoftIntegrationView: React.FC<MysoftIntegrationViewProps> = ({
  initialConfig,
  statusRecords: initialStatusRecords,
  incomingInvoices: initialIncomingInvoices,
  creditLogs: initialCreditLogs,
  onConfigSave,
  onRecordsChange,
  onIncomingChange,
  onCreditLogsChange,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'taxpayer' | 'queue' | 'incoming' | 'credits'>('settings');

  // Form State
  const [config, setConfig] = useState<MysoftApiConfig>(() => initialConfig || {
    serviceUrl: 'https://edonusum.mysoft.com.tr/api/v1',
    testServiceUrl: 'https://test-edonusum.mysoft.com.tr/api/v1',
    environment: 'PRODUCTION',
    username: 'anadolu_teknoloji_gib',
    password: '••••••••••••',
    vknTckn: '4820194829',
    senderAliasGb: 'urn:mail:defaultgb@anadoludijital.com.tr',
    receiverAliasPk: 'urn:mail:defaultpk@anadoludijital.com.tr',
    apiKey: 'mys_live_89f02c31e7845ba012e8b',
    eInvoicePrefix: 'EFT',
    eArchivePrefix: 'EAR',
    eDespatchPrefix: 'IRS',
    eProducerPrefix: 'MMB',
    autoSendGib: true,
    autoApproveBasic: true,
    creditBalance: 3840,
    lastCreditSync: '2026-11-04 16:30',
    isVerified: true,
    webhookUrl: 'https://anadoludijital.com.tr/api/webhooks/mysoft',
  });

  const [statusRecords, setStatusRecords] = useState<MysoftInvoiceStatusRecord[]>(initialStatusRecords);
  const [incomingInvoices, setIncomingInvoices] = useState<IncomingInvoice[]>(initialIncomingInvoices);
  const [creditLogs, setCreditLogs] = useState<MysoftCreditLog[]>(initialCreditLogs);

  // Interaction feedback states
  const [testResult, setTestResult] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
    pingMs?: number;
    details?: any;
  }>({ loading: false });

  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Taxpayer lookup state
  const [searchVkn, setSearchVkn] = useState('8392019284');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [taxpayerResult, setTaxpayerResult] = useState<MysoftTaxpayerLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Modals
  const [rejectModalInvoice, setRejectModalInvoice] = useState<IncomingInvoice | null>(null);
  const [rejectReason, setRejectReason] = useState('Faturada sipariş no ve fiyat mutabakatı uyuşmuyor.');
  const [cancelModalRecord, setCancelModalRecord] = useState<MysoftInvoiceStatusRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('Müşteri iade/vazgeçme talebi doğrultusunda iptal.');
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<{ title: string; number: string; type: string; xml: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  // Test Connection
  const handleTestConnection = async () => {
    setTestResult({ loading: true });
    try {
      const res = await testMysoftConnection(config);
      setTestResult({
        loading: false,
        success: res.success,
        message: res.message,
        pingMs: res.pingMs,
        details: res,
      });
      if (res.success) {
        showToast('success', res.message);
      } else {
        showToast('error', res.message);
      }
    } catch (err: any) {
      setTestResult({
        loading: false,
        success: false,
        message: err.message || 'Bağlantı hatası meydana geldi.',
      });
      showToast('error', err.message || 'Bağlantı hatası.');
    }
  };

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (onConfigSave) {
      onConfigSave(config);
    }
    showToast('success', 'Mysoft e-Dönüşüm entegrasyon ayarları başarıyla güncellendi.');
  };

  // Taxpayer Lookup
  const handleLookupTaxpayer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchVkn || searchVkn.trim().length < 10) {
      setLookupError('Lütfen geçerli 10 haneli VKN veya 11 haneli TCKN girin.');
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await queryMysoftTaxpayer(searchVkn);
      setTaxpayerResult(res);
      showToast('success', `${res.title} için GİB mükellef bilgisi Mysoft üzerinden sorgulandı.`);
    } catch (err: any) {
      setLookupError(err.message || 'Mükellef bulunamadı.');
      setTaxpayerResult(null);
    } finally {
      setLookupLoading(false);
    }
  };

  // Sync Queue Statuses
  const handleSyncStatuses = () => {
    const updated = syncMysoftInvoiceStatuses(statusRecords);
    setStatusRecords(updated);
    if (onRecordsChange) onRecordsChange(updated);
    showToast('success', 'GİB ve Mysoft kuyruk durumları başarıyla senkronize edildi. (Kuyruktaki belgeler 1200 koduna güncellendi)');
  };

  // Cancel e-Arşiv
  const handleConfirmCancel = () => {
    if (!cancelModalRecord) return;
    const res = cancelMysoftEArchiveInvoice(cancelModalRecord, cancelReason);
    if (res.success) {
      const updated = statusRecords.map((r) => (r.id === res.record.id ? res.record : r));
      setStatusRecords(updated);
      if (onRecordsChange) onRecordsChange(updated);
      showToast('success', res.message);
      setCancelModalRecord(null);
    } else {
      showToast('error', res.message);
    }
  };

  // Respond to Incoming Invoice
  const handleAcceptIncoming = (inv: IncomingInvoice) => {
    const res = respondToIncomingInvoice(inv, 'KABUL_EDILDI');
    if (res.success) {
      const updated = incomingInvoices.map((i) => (i.id === res.updatedInvoice.id ? res.updatedInvoice : i));
      setIncomingInvoices(updated);
      if (onIncomingChange) onIncomingChange(updated);
      showToast('success', res.message);
    } else {
      showToast('error', res.message);
    }
  };

  const handleConfirmReject = () => {
    if (!rejectModalInvoice) return;
    const res = respondToIncomingInvoice(rejectModalInvoice, 'REDDEDILDI', rejectReason);
    if (res.success) {
      const updated = incomingInvoices.map((i) => (i.id === res.updatedInvoice.id ? res.updatedInvoice : i));
      setIncomingInvoices(updated);
      if (onIncomingChange) onIncomingChange(updated);
      showToast('success', res.message);
      setRejectModalInvoice(null);
    } else {
      showToast('error', res.message);
    }
  };

  // Top Up Credits
  const handleBuyCredits = (amount: number, packageName: string) => {
    const { updatedConfig, newLog } = topUpMysoftCredits(config, creditLogs, amount, packageName);
    setConfig(updatedConfig);
    const updatedLogs = [newLog, ...creditLogs];
    setCreditLogs(updatedLogs);
    if (onCreditLogsChange) onCreditLogsChange(updatedLogs, updatedConfig.creditBalance);
    if (onConfigSave) onConfigSave(updatedConfig);
    showToast('success', `Tebrikler! ${amount.toLocaleString('tr-TR')} kontör hesabınıza tanımlandı. Güncel Bakiye: ${updatedConfig.creditBalance.toLocaleString('tr-TR')}`);
  };

  // XML / PDF Preview Mock
  const handleOpenPreview = (title: string, number: string, type: string) => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>${type === 'E_FATURA' ? 'TICARIFATURA' : 'EARSIVFATURA'}</cbc:ProfileID>
  <cbc:ID>${number}</cbc:ID>
  <cbc:CopyIndicator>false</cbc:CopyIndicator>
  <cbc:UUID>9b2a7591-628d-4f81-a90f-901a89b027c1</cbc:UUID>
  <cbc:IssueDate>2026-11-04</cbc:IssueDate>
  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="VKN">${config.vknTckn}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>Anadolu Dijital Teknoloji A.Ş.</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${title}</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <!-- Mysoft HSM Mali Mühür İmzalı UBL-TR Zarfı -->
</Invoice>`;
    setSelectedPreviewDoc({ title, number, type, xml: mockXml });
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl shadow-md border text-sm font-medium transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">
              {notification.type === 'success' ? '✓' : notification.type === 'error' ? '⚠' : 'ℹ'}
            </span>
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-semibold px-2 py-1 rounded hover:bg-black/5"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Hero Header & Quick Stats */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-900/50">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-3xl shadow-inner">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Mysoft e-Dönüşüm Merkezi</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  GİB Onaylı Özel Entegratör
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  config.environment === 'PRODUCTION'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {config.environment === 'PRODUCTION' ? 'CANLI MOD' : 'TEST SANDBOX'}
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1">
                GİB e-Fatura, e-Arşiv Fatura, e-İrsaliye ve e-Müstahsil UBL-TR 1.2 zarflama ve otomatik mutabakat modülü.
              </p>
            </div>
          </div>

          {/* Quick Credit Status Pill */}
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-xl border border-white/15">
            <div className="text-right">
              <span className="text-xs text-slate-300 block uppercase font-medium">Kalan Kontör</span>
              <span className="text-2xl font-black text-amber-300 tracking-tight">
                {config.creditBalance.toLocaleString('tr-TR')}
              </span>
            </div>
            <button
              onClick={() => setActiveTab('credits')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-lg transition-colors shadow"
            >
              + Kontör Yükle
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-white/10">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            ⚙ API & Bağlantı Ayarları
          </button>
          <button
            onClick={() => setActiveTab('taxpayer')}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'taxpayer'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            🔍 Canlı GİB Mükellef Sorgula
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'queue'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>📤 GİB e-Belge Kuyruğu</span>
            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white">
              {statusRecords.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('incoming')}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'incoming'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>📥 Gelen Faturalar (Kutu)</span>
            {incomingInvoices.filter((i) => i.statusCode === 'BEKLEMEDE').length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950">
                {incomingInvoices.filter((i) => i.statusCode === 'BEKLEMEDE').length} Onay
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('credits')}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'credits'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            💳 Kontör Hareketleri & Paketler
          </button>
        </div>
      </div>

      {/* Tab 1: API & Bağlantı Ayarları */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Mysoft Özel Entegratör API Kimlik Bilgileri</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  GİB UBL-TR API uç noktası ve HSM Mali Mühür imzalama yetkilendirme parametreleri.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-md font-mono bg-slate-100 text-slate-700">
                v1.2.1 UBL-TR
              </span>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Çalışma Ortamı (Environment)
                  </label>
                  <select
                    value={config.environment}
                    onChange={(e) => setConfig({ ...config, environment: e.target.value as 'PRODUCTION' | 'SANDBOX' })}
                    className="w-full text-sm font-medium border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PRODUCTION">Canlı Ağ (Production GİB)</option>
                    <option value="SANDBOX">Test Ortamı (Sandbox / Mysoft Test)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Firma VKN / TCKN
                  </label>
                  <input
                    type="text"
                    value={config.vknTckn}
                    onChange={(e) => setConfig({ ...config, vknTckn: e.target.value })}
                    className="w-full text-sm font-medium border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="10 veya 11 haneli numara"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Mysoft API Kullanıcı Adı
                  </label>
                  <input
                    type="text"
                    value={config.username}
                    onChange={(e) => setConfig({ ...config, username: e.target.value })}
                    className="w-full text-sm font-medium border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Mysoft API Şifresi
                  </label>
                  <input
                    type="password"
                    value={config.password}
                    onChange={(e) => setConfig({ ...config, password: e.target.value })}
                    className="w-full text-sm font-medium border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Entegratör API Token / Secret Key
                </label>
                <input
                  type="text"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  className="w-full text-sm font-mono border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    GİB Gönderici Birim Posta Kutusu (GB Alias)
                  </label>
                  <input
                    type="text"
                    value={config.senderAliasGb}
                    onChange={(e) => setConfig({ ...config, senderAliasGb: e.target.value })}
                    className="w-full text-sm font-mono border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="urn:mail:defaultgb@..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    GİB Posta Kutusu Etiketi (PK Alias)
                  </label>
                  <input
                    type="text"
                    value={config.receiverAliasPk}
                    onChange={(e) => setConfig({ ...config, receiverAliasPk: e.target.value })}
                    className="w-full text-sm font-mono border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="urn:mail:defaultpk@..."
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                  GİB 3 Haneli Seri Ön Ekleri (2026 Yılı)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">e-Fatura Seri</label>
                    <input
                      type="text"
                      maxLength={3}
                      value={config.eInvoicePrefix}
                      onChange={(e) => setConfig({ ...config, eInvoicePrefix: e.target.value.toUpperCase() })}
                      className="w-full text-center font-mono font-bold text-sm border border-slate-300 rounded-lg p-2 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">e-Arşiv Seri</label>
                    <input
                      type="text"
                      maxLength={3}
                      value={config.eArchivePrefix}
                      onChange={(e) => setConfig({ ...config, eArchivePrefix: e.target.value.toUpperCase() })}
                      className="w-full text-center font-mono font-bold text-sm border border-slate-300 rounded-lg p-2 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">e-İrsaliye Seri</label>
                    <input
                      type="text"
                      maxLength={3}
                      value={config.eDespatchPrefix}
                      onChange={(e) => setConfig({ ...config, eDespatchPrefix: e.target.value.toUpperCase() })}
                      className="w-full text-center font-mono font-bold text-sm border border-slate-300 rounded-lg p-2 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">e-Müstahsil Seri</label>
                    <input
                      type="text"
                      maxLength={3}
                      value={config.eProducerPrefix}
                      onChange={(e) => setConfig({ ...config, eProducerPrefix: e.target.value.toUpperCase() })}
                      className="w-full text-center font-mono font-bold text-sm border border-slate-300 rounded-lg p-2 uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoSendGib}
                    onChange={(e) => setConfig({ ...config, autoSendGib: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Pazaryeri siparişleri onaylandığında faturayı otomatik oluştur ve Mysoft HSM Mali Mühür ile GİB'e ilet.
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoApproveBasic}
                    onChange={(e) => setConfig({ ...config, autoApproveBasic: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Gelen Temel Faturaları (TEMELFATURA) sisteme otomatik kabul olarak aktar.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testResult.loading}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 flex items-center gap-2 transition"
                >
                  {testResult.loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                      Test Ediliyor...
                    </>
                  ) : (
                    <>
                      <span>🔌</span>
                      Bağlantıyı Sına (Ping)
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition"
                >
                  Mysoft Ayarlarını Kaydet
                </button>
              </div>
            </form>
          </div>

          {/* Right Sidebar: Connection Status Card & Webhook */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>🛡</span> HSM Mali Mühür Durumu
              </h4>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Sertifika Türü:</span>
                  <span className="font-semibold text-slate-800">Bulut Mali Mühür (HSM)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Sağlayıcı:</span>
                  <span className="font-semibold text-slate-800">TÜBİTAK KamuSM</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Seri No:</span>
                  <span className="font-mono text-slate-700">TUBITAK-7729104</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Geçerlilik Bitiş:</span>
                  <span className="font-semibold text-emerald-600">18.04.2028 (Aktif)</span>
                </div>
              </div>

              {testResult.message && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>{testResult.success ? 'Bağlantı Başarılı' : 'Bağlantı Hatası'}</span>
                    {testResult.pingMs && <span>{testResult.pingMs} ms</span>}
                  </div>
                  <p>{testResult.message}</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>🔔</span> Mysoft Canlı Webhook Bildirimi
              </h4>
              <p className="text-xs text-slate-500">
                Gelen faturalar, onay/red yanıtları ve GİB durum kodları için Mysoft portalına tanımlanacak webhook URL:
              </p>
              <div className="p-2.5 rounded-lg bg-slate-100 font-mono text-[11px] text-slate-800 break-all select-all border border-slate-200">
                {config.webhookUrl}
              </div>
              <div className="text-[11px] text-slate-400">
                HMAC-SHA256 imzası ile tüm olaylar otomatik tetiklenir.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Canlı GİB Mükellef Sorgulama */}
      {activeTab === 'taxpayer' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Canlı GİB Kayıtlı Kullanıcı (Mükellef) Sorgusu
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Müşteri veya tedarikçinin VKN / TCKN numarasını sorgulayarak e-Fatura mükellefi olup olmadığını,
              tanımlı GB ve PK posta kutusu etiketlerini anlık olarak Mysoft ağ geçidinden çekin.
            </p>

            <form onSubmit={handleLookupTaxpayer} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchVkn}
                  onChange={(e) => setSearchVkn(e.target.value.replace(/\D/g, ''))}
                  placeholder="VKN (10 hane) veya TCKN (11 hane) girin (Örn: 8392019284)"
                  maxLength={11}
                  className="w-full text-base font-medium px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow transition flex items-center justify-center gap-2"
                >
                  {lookupLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sorgulanıyor...
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      GİB'de Sorgula
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSearchVkn('9182736450');
                    setTimeout(() => handleLookupTaxpayer(), 50);
                  }}
                  className="px-3 py-3 border border-slate-300 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-100"
                  title="Örnek Firma VKN"
                >
                  Örnek 1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchVkn('12345678901');
                    setTimeout(() => handleLookupTaxpayer(), 50);
                  }}
                  className="px-3 py-3 border border-slate-300 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-100"
                  title="Örnek Bireysel TCKN"
                >
                  Örnek TCKN
                </button>
              </div>
            </form>

            {lookupError && (
              <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
                ⚠ {lookupError}
              </div>
            )}

            {taxpayerResult && (
              <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      Mükellef Unvanı
                    </span>
                    <h4 className="text-base font-bold text-slate-900">{taxpayerResult.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {taxpayerResult.isEInvoiceUser ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ✓ e-Fatura Mükellefi
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        e-Arşiv Fatura Alıcısı
                      </span>
                    )}

                    {taxpayerResult.isEDespatchUser && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                        e-İrsaliye Kayıtlı
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-white">
                  <div>
                    <span className="text-xs text-slate-400 block font-semibold">VKN / TCKN</span>
                    <span className="font-mono font-bold text-slate-800">{taxpayerResult.vknTckn}</span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block font-semibold">Vergi Dairesi & İl</span>
                    <span className="font-medium text-slate-800">
                      {taxpayerResult.taxOffice || '-'} / {taxpayerResult.city || '-'}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block font-semibold">GİB Kayıt Tarihi</span>
                    <span className="font-medium text-slate-800">{taxpayerResult.firstRegisteredDate}</span>
                  </div>

                  <div className="md:col-span-3 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400 block font-semibold mb-1">
                      Kayıtlı Gönderici Birim (GB) Etiketleri:
                    </span>
                    {(taxpayerResult.aliasesGb && taxpayerResult.aliasesGb.length > 0) ? (
                      <div className="flex flex-wrap gap-2">
                        {taxpayerResult.aliasesGb.map((gb, i) => (
                          <span
                            key={i}
                            className="font-mono text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border"
                          >
                            {gb}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Tanımlı GB etiketi yok.</span>
                    )}
                  </div>

                  <div className="md:col-span-3 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400 block font-semibold mb-1">
                      Kayıtlı Posta Kutusu (PK) Etiketleri:
                    </span>
                    {(taxpayerResult.aliasesPk && taxpayerResult.aliasesPk.length > 0) ? (
                      <div className="flex flex-wrap gap-2">
                        {taxpayerResult.aliasesPk.map((pk, i) => (
                          <span
                            key={i}
                            className="font-mono text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 font-semibold"
                          >
                            {pk}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Tanımlı PK etiketi yok (e-Arşiv düzenlenmeli).</span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                  <span>Sorgu Zamanı: {taxpayerResult.lookupTimestamp}</span>
                  <span className="font-semibold text-indigo-600">Önerilen Fatura Senaryosu: {taxpayerResult.systemType}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: GİB e-Belge Kuyruğu & Durum Takibi */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">GİB e-Belge Gönderim Kuyruğu & Zarf Durumları</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mysoft HSM ile imzalanan faturaların GİB 1000/1200/1220/1230 durum kodları ve iptal süreçleri.
              </p>
            </div>
            <button
              onClick={handleSyncStatuses}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow transition flex items-center gap-2"
            >
              <span>🔄</span>
              GİB Durumlarını Senkronize Et
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px] border-b">
                <tr>
                  <th className="py-3 px-3">Fatura No / ETTN</th>
                  <th className="py-3 px-3">Sipariş No</th>
                  <th className="py-3 px-3">Alıcı / Müşteri</th>
                  <th className="py-3 px-3">Tür / Senaryo</th>
                  <th className="py-3 px-3 text-right">Tutar</th>
                  <th className="py-3 px-3">GİB Durumu</th>
                  <th className="py-3 px-3 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statusRecords.map((rec) => {
                  const is1000 = rec.gibStatusCode === 1000;
                  const is1200 = rec.gibStatusCode === 1200;
                  const is1220 = rec.gibStatusCode === 1220;
                  const is1300 = rec.gibStatusCode === 1300;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-3">
                        <div className="font-mono font-bold text-slate-900">{rec.invoiceNumber}</div>
                        <div className="font-mono text-[10px] text-slate-400">{rec.ettn}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-slate-700">{rec.marketplaceOrderId}</span>
                        <div className="text-[10px] text-slate-400">{rec.sentDate}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-800 line-clamp-1">{rec.customerTitle}</div>
                        <div className="font-mono text-xs text-slate-400">VKN: {rec.customerVkn}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          rec.documentType === 'E_FATURA'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {rec.documentType === 'E_FATURA' ? 'e-Fatura' : 'e-Arşiv'}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-0.5">{rec.scenario}</div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                        {(rec.payableAmount || rec.amountTry || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          is1000
                            ? 'bg-amber-100 text-amber-800'
                            : is1200
                            ? 'bg-blue-100 text-blue-800'
                            : is1220
                            ? 'bg-emerald-100 text-emerald-800'
                            : is1300
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            is1000 ? 'bg-amber-500' : is1200 ? 'bg-blue-500' : is1220 ? 'bg-emerald-500' : 'bg-rose-500'
                          }`} />
                          {rec.gibStatusCode || rec.statusCode} - {is1000 ? 'Kuyrukta' : is1200 ? 'GİB İletildi' : is1220 ? 'Alıcıya Ulaştı' : is1300 ? 'İptal Edildi' : 'Başarılı'}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-1 max-w-xs line-clamp-1">
                          {rec.gibStatusDescription || rec.statusDescription}
                        </p>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenPreview(rec.customerTitle || rec.customerName || '', rec.invoiceNumber || rec.gibInvoiceNumber || '', rec.documentType || 'E_FATURA')}
                            className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 transition"
                            title="UBL-TR XML / HTML Görüntüle"
                          >
                            👁
                          </button>

                          {rec.documentType === 'E_ARSIV' && rec.gibStatusCode !== 1300 && (
                            <button
                              onClick={() => setCancelModalRecord(rec)}
                              className="px-2 py-1 rounded text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                              title="8 Günlük Yasal Süre İçinde e-Arşiv İptali"
                            >
                              İptal Et
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Gelen Faturalar / Gelen Kutusu */}
      {activeTab === 'incoming' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Gelen Kutusu (GİB Tedarikçi Faturaları)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mysoft posta kutunuza (PK) düşen faturalar. Ticari faturalarda 8 günlük yasal süre içinde Kabul / Red yanıtı verilmelidir.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
              PK: {config.receiverAliasPk}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px] border-b">
                <tr>
                  <th className="py-3 px-3">Tedarikçi / Düzenleyen</th>
                  <th className="py-3 px-3">Fatura No / Tarih</th>
                  <th className="py-3 px-3">Senaryo</th>
                  <th className="py-3 px-3 text-right">KDV & Genel Tutar</th>
                  <th className="py-3 px-3">Durum & Yasal Süre</th>
                  <th className="py-3 px-3 text-center">GİB Yanıtı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incomingInvoices.map((inv) => {
                  const isPending = inv.statusCode === 'BEKLEMEDE';
                  const isAccepted = inv.statusCode === 'KABUL_EDILDI';
                  const isRejected = inv.statusCode === 'REDDEDILDI';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900">{inv.supplierTitle}</div>
                        <div className="font-mono text-xs text-slate-400">VKN: {inv.supplierVkn}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-mono font-semibold text-slate-800">{inv.invoiceNumber}</div>
                        <div className="text-xs text-slate-500">Düzenleme: {inv.issueDate}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          inv.scenario === 'TICARIFATURA'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {inv.scenario}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-0.5">{inv.itemCount} Kalem Malzeme</div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono">
                        <div className="font-bold text-slate-900">
                          {inv.payableAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </div>
                        <div className="text-xs text-slate-400">
                          KDV: {(inv.totalVat || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          isPending
                            ? 'bg-amber-100 text-amber-800'
                            : isAccepted
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {isPending ? '⏳ Yanıt Bekliyor' : isAccepted ? '✓ Kabul Edildi' : '✕ Reddedildi'}
                        </span>
                        {isPending && inv.gibResponseDeadline && (
                          <div className="text-[10px] text-rose-600 font-semibold mt-1">
                            Son Yanıt: {inv.gibResponseDeadline}
                          </div>
                        )}
                        {inv.responseDate && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            {inv.responseDate}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {isPending ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleAcceptIncoming(inv)}
                              className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition"
                            >
                              Kabul Et
                            </button>
                            <button
                              onClick={() => {
                                setRejectModalInvoice(inv);
                                setRejectReason('Faturada sipariş no ve fiyat mutabakatı uyuşmuyor.');
                              }}
                              className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow transition"
                            >
                              Reddet
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Tamamlandı</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Kontör & Paketler */}
      {activeTab === 'credits' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-800/40 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Mevcut Mysoft Bakiyesi</span>
              <div className="text-4xl font-black text-amber-400 tracking-tight">
                {config.creditBalance.toLocaleString('tr-TR')}
              </div>
              <p className="text-xs text-indigo-200">
                Her e-Fatura, e-Arşiv, e-İrsaliye ve GİB uygulama yanıtı 1 kontör tüketir.
              </p>
              <div className="pt-2 text-[11px] text-slate-400 border-t border-indigo-800/40">
                Son Senkronizasyon: {config.lastCreditSync}
              </div>
            </div>

            <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900">Kurumsal Mysoft Kontör Paketleri Satın Al</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 transition space-y-2 text-center bg-slate-50">
                  <span className="text-xs font-bold text-slate-600 uppercase">Başlangıç Paketi</span>
                  <div className="text-2xl font-black text-slate-900">1.000 Kontör</div>
                  <div className="text-sm font-semibold text-indigo-600">850 ₺ + KDV</div>
                  <button
                    onClick={() => handleBuyCredits(1000, 'Mysoft 1.000 Kontör Paketi')}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition"
                  >
                    Yükle
                  </button>
                </div>

                <div className="p-4 rounded-xl border-2 border-indigo-600 relative space-y-2 text-center bg-indigo-50/50">
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white uppercase">
                    En Çok Tercih Edilen
                  </span>
                  <span className="text-xs font-bold text-slate-600 uppercase">KOBİ E-Ticaret</span>
                  <div className="text-2xl font-black text-slate-900">5.000 Kontör</div>
                  <div className="text-sm font-semibold text-indigo-600">3.400 ₺ + KDV</div>
                  <button
                    onClick={() => handleBuyCredits(5000, 'Mysoft 5.000 KOBİ Kontör Paketi')}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition"
                  >
                    Yükle
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 transition space-y-2 text-center bg-slate-50">
                  <span className="text-xs font-bold text-slate-600 uppercase">Kurumsal Kurum</span>
                  <div className="text-2xl font-black text-slate-900">20.000 Kontör</div>
                  <div className="text-sm font-semibold text-indigo-600">11.800 ₺ + KDV</div>
                  <button
                    onClick={() => handleBuyCredits(20000, 'Mysoft 20.000 Kurumsal Kontör Paketi')}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition"
                  >
                    Yükle
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">Son Kontör Hareketleri</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px] border-b">
                  <tr>
                    <th className="py-2.5 px-3">Tarih</th>
                    <th className="py-2.5 px-3">İşlem Türü</th>
                    <th className="py-2.5 px-3">Açıklama</th>
                    <th className="py-2.5 px-3 text-right">Miktar</th>
                    <th className="py-2.5 px-3 text-right">Kalan Bakiye</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {creditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 text-slate-600 font-sans">{log.date}</td>
                      <td className="py-3 px-3 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          log.transactionType === 'YUKLEME'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {log.transactionType === 'YUKLEME' ? '+ Yükleme' : '- Harcama'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-800 font-sans">{log.description}</td>
                      <td className={`py-3 px-3 text-right font-bold ${log.amount > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                        {log.amount > 0 ? `+${log.amount}` : log.amount}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {log.balanceAfter.toLocaleString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold">Ticari e-Faturayı Reddet (Uygulama Yanıtı)</h3>
            </div>
            <p className="text-xs text-slate-600">
              {rejectModalInvoice.invoiceNumber} numaralı ticari faturayı reddettiğinizde GİB üzerinden Mysoft aracılığıyla red zarfı iletilecektir.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Red Gerekçesi:</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalInvoice(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow"
              >
                Reddet ve GİB'e İlet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel e-Arşiv Modal */}
      {cancelModalRecord && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold">e-Arşiv Fatura İptali</h3>
            </div>
            <p className="text-xs text-slate-600">
              {cancelModalRecord.invoiceNumber} numaralı e-Arşiv fatura için GİB e-Arşiv İptal Raporu düzenlenecektir.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">İptal Gerekçesi:</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalRecord(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow"
              >
                İptal Raporunu Bildir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UBL-TR XML / HTML Preview Modal */}
      {selectedPreviewDoc && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">{selectedPreviewDoc.number} - UBL-TR Belge Önizlemesi</h3>
                <span className="text-xs text-slate-500">{selectedPreviewDoc.title}</span>
              </div>
              <button
                onClick={() => setSelectedPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-slate-900 text-slate-200 font-mono text-xs rounded-b-2xl">
              <pre>{selectedPreviewDoc.xml}</pre>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 rounded-b-2xl">
              <button
                onClick={() => {
                  showToast('info', 'UBL-TR 2.1 XML dosyası indirildi.');
                  setSelectedPreviewDoc(null);
                }}
                className="px-3.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700"
              >
                XML İndir
              </button>
              <button
                onClick={() => setSelectedPreviewDoc(null)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
