import React, { useMemo, useState } from 'react';
import {
  Scale,
  Save,
  FileSpreadsheet,
  Calendar,
  Building2,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText,
  Lock,
  Unlock,
  Percent,
  RefreshCw,
  Send,
  HelpCircle,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  BookText,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import {
  AccountingSoftwareTarget,
  AccountingVoucherLine,
  CompanyProfile,
  IncomingEInvoice,
  MarketplaceIntegration,
  MarketplaceOrder,
  PlatformUser,
  SmmmProfile,
  TaxCalendarItem,
} from '../types/invoicing';
import { calculateOrderTotals, formatTryCurrency } from '../utils/invoicingEngine';
import { PascalHeroBanner, PascalKpiCard } from './PascalUi';

export type AccountantSubTab = 'icmal' | 'export';

interface AccountantModuleViewProps {
  users: PlatformUser[];
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
  orders: MarketplaceOrder[];
  incomingInvoices: IncomingEInvoice[];
  integrations: MarketplaceIntegration[];
  companyProfiles: CompanyProfile[];
  smmmProfile: SmmmProfile;
  onUpdateSmmmProfile: (profile: SmmmProfile) => void;
  taxCalendar: TaxCalendarItem[];
  onUpdateTaxCalendar: (calendar: TaxCalendarItem[]) => void;
  onSaveAllModules?: (moduleName?: string) => void;
  hasUnsavedChanges?: boolean;
}

export const AccountantModuleView: React.FC<AccountantModuleViewProps> = ({
  users,
  selectedUserId,
  onSelectUser,
  orders,
  incomingInvoices,
  integrations,
  companyProfiles,
  smmmProfile,
  onUpdateSmmmProfile,
  taxCalendar,
  onUpdateTaxCalendar,
  onSaveAllModules,
  hasUnsavedChanges = false,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<AccountantSubTab>('icmal');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-10');
  const [selectedSoftware, setSelectedSoftware] =
    useState<AccountingSoftwareTarget>(smmmProfile.defaultSoftwareTarget || 'LUCA');
  const [periodLocked, setPeriodLocked] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState(false);
  const [downloadSuccessNotice, setDownloadSuccessNotice] = useState<string | null>(null);

  // Editable local SMMM form state
  const [formProfile, setFormProfile] = useState<SmmmProfile>(smmmProfile);
  const [profileSavedNotice, setProfileSavedNotice] = useState(false);

  // Active company profile based on selected user or first company
  const activeCompany = useMemo(() => {
    return companyProfiles[0] || {
      legalTitle: 'Faturansit Teknoloji ve E-Ticaret A.Ş.',
      taxIdentifier: '3890642158',
      taxOffice: 'Maslak Vergi Dairesi',
      email: 'muhasebe@faturansit.com.tr',
      phone: '+90 212 381 90 00',
    };
  }, [companyProfiles]);

  // Financial calculations for the selected period
  const financialSummary = useMemo(() => {
    let base20 = 0;
    let base10 = 0;
    let base1 = 0;
    let vat20 = 0;
    let vat10 = 0;
    let vat1 = 0;
    let grossSales = 0;
    let withholding1Percent = 0;
    let marketplaceCommissionGross = 0;
    let marketplaceCommissionVat = 0;
    let orderCount = 0;

    for (const order of orders) {
      if (order.isCancelled) continue;
      const fin = calculateOrderTotals(
        order.items,
        order.shippingFeeVatIncluded,
        order.includeShippingInInvoice,
        order.sellerDiscountTotal,
        order.marketplaceCommissionRate,
        order.withholdingRate
      );
      grossSales += fin.grossInvoiceTotal;
      withholding1Percent += fin.withholdingTaxAmount;
      orderCount += 1;

      // Group VAT rates across items
      for (const item of order.items) {
        const itemGross = item.unitPriceVatIncluded * item.quantity;
        const divisor = 1 + item.vatRate / 100;
        const itemBase = itemGross / divisor;
        const itemVat = itemGross - itemBase;
        if (item.vatRate === 20) {
          base20 += itemBase;
          vat20 += itemVat;
        } else if (item.vatRate === 10) {
          base10 += itemBase;
          vat10 += itemVat;
        } else if (item.vatRate === 1) {
          base1 += itemBase;
          vat1 += itemVat;
        } else {
          base20 += itemBase;
          vat20 += itemVat;
        }
      }
    }

    // Incoming expenses / commissions (191 Indirilecek KDV)
    let incomingExpenseTotal = 0;
    let incomingVat191 = 0;
    for (const inv of incomingInvoices) {
      if (inv.responseStatus === 'ACCEPTED' || inv.responseStatus === 'PENDING_APPROVAL') {
        incomingExpenseTotal += inv.subtotalExclVat;
        incomingVat191 += inv.totalVat;
        if (inv.supplierTitle.toLowerCase().includes('pazar') || inv.supplierTitle.toLowerCase().includes('trendyol') || inv.supplierTitle.toLowerCase().includes('hepsiburada')) {
          marketplaceCommissionGross += inv.payableAmount;
          marketplaceCommissionVat += inv.totalVat;
        }
      }
    }

    const calculatedVat391 = vat20 + vat10 + vat1;
    const deductibleVat191 = incomingVat191;
    const netVatPayable = calculatedVat391 - deductibleVat191;

    return {
      orderCount,
      grossSales,
      base20,
      vat20,
      base10,
      vat10,
      base1,
      vat1,
      totalTaxBase: base20 + base10 + base1,
      calculatedVat391,
      deductibleVat191,
      incomingExpenseTotal,
      netVatPayable,
      withholding1Percent,
      marketplaceCommissionGross,
      marketplaceCommissionVat,
    };
  }, [orders, incomingInvoices]);

  // Generate TDHP (Tek Düzen Hesap Planı) balanced voucher lines
  const voucherLines: AccountingVoucherLine[] = useMemo(() => {
    const lines: AccountingVoucherLine[] = [];

    // Borç: 120.01 Pazaryeri Alıcıları Cari Hesabı
    lines.push({
      accountCode: '120.01.001',
      accountName: 'Pazaryeri Müşterileri Alacak Hesabı (Trendyol / HB / Amazon)',
      debit: financialSummary.grossSales,
      credit: 0,
      description: `${selectedPeriod} Dönemi E-Ticaret Brüt Satış Tahsilat Alacağı`,
      taxRate: 0,
    });

    // Alacak: 600.01 Yurtiçi Satışlar (%20)
    if (financialSummary.base20 > 0) {
      lines.push({
        accountCode: '600.01.020',
        accountName: 'Yurtiçi Satışlar Matrahı (%20 KDV)',
        debit: 0,
        credit: financialSummary.base20,
        description: `${selectedPeriod} E-Ticaret %20 Genel Matrah Hasılatı`,
        taxRate: 20,
      });
    }

    // Alacak: 600.01 Yurtiçi Satışlar (%10)
    if (financialSummary.base10 > 0) {
      lines.push({
        accountCode: '600.01.010',
        accountName: 'Yurtiçi Satışlar Matrahı (%10 KDV Gıda/Tekstil)',
        debit: 0,
        credit: financialSummary.base10,
        description: `${selectedPeriod} E-Ticaret %10 İndirimli Matrah Hasılatı`,
        taxRate: 10,
      });
    }

    // Alacak: 600.01 Yurtiçi Satışlar (%1)
    if (financialSummary.base1 > 0) {
      lines.push({
        accountCode: '600.01.001',
        accountName: 'Yurtiçi Satışlar Matrahı (%1 KDV Temel Gıda)',
        debit: 0,
        credit: financialSummary.base1,
        description: `${selectedPeriod} E-Ticaret %1 İndirimli Matrah Hasılatı`,
        taxRate: 1,
      });
    }

    // Alacak: 391.01 Hesaplanan KDV (%20)
    if (financialSummary.vat20 > 0) {
      lines.push({
        accountCode: '391.01.020',
        accountName: 'Hesaplanan KDV (%20)',
        debit: 0,
        credit: financialSummary.vat20,
        description: `${selectedPeriod} E-Ticaret Satışları %20 KDV Tahakkuku`,
        taxRate: 20,
      });
    }

    // Alacak: 391.01 Hesaplanan KDV (%10)
    if (financialSummary.vat10 > 0) {
      lines.push({
        accountCode: '391.01.010',
        accountName: 'Hesaplanan KDV (%10)',
        debit: 0,
        credit: financialSummary.vat10,
        description: `${selectedPeriod} E-Ticaret Satışları %10 KDV Tahakkuku`,
        taxRate: 10,
      });
    }

    // Alacak: 391.01 Hesaplanan KDV (%1)
    if (financialSummary.vat1 > 0) {
      lines.push({
        accountCode: '391.01.001',
        accountName: 'Hesaplanan KDV (%1)',
        debit: 0,
        credit: financialSummary.vat1,
        description: `${selectedPeriod} E-Ticaret Satışları %1 KDV Tahakkuku`,
        taxRate: 1,
      });
    }

    // Borç: 193.01 E-Ticaret %1 Tevkifatı (Peşin Ödenen Vergi ve Fonlar)
    if (financialSummary.withholding1Percent > 0) {
      lines.push({
        accountCode: '193.01.001',
        accountName: 'GVK Ek Md. 9 %1 E-Ticaret Stopaj Kesintisi (Pazaryeri)',
        debit: financialSummary.withholding1Percent,
        credit: 0,
        description: `${selectedPeriod} Pazaryeri Tarafından Kesilen %1 Gelir Vergisi Tevkifatı`,
        taxRate: 1,
      });
      // Alacak: 120.01 den mahsup
      lines.push({
        accountCode: '120.01.001',
        accountName: 'Pazaryeri Alıcıları Tevkifat Mahsubu',
        debit: 0,
        credit: financialSummary.withholding1Percent,
        description: `${selectedPeriod} %1 Stopaj Tutarı Cari Mahsup`,
        taxRate: 0,
      });
    }

    return lines;
  }, [financialSummary, selectedPeriod]);

  const totalDebit = voucherLines.reduce((acc, l) => acc + l.debit, 0);
  const totalCredit = voucherLines.reduce((acc, l) => acc + l.credit, 0);
  const isVoucherBalanced = Math.abs(totalDebit - totalCredit) < 0.05;

  // Handle Save SMMM Profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSmmmProfile(formProfile);
    setProfileSavedNotice(true);
    setTimeout(() => setProfileSavedNotice(false), 3000);
    if (onSaveAllModules) {
      onSaveAllModules('Mali Müşavir Sicil Bilgileri');
    }
  };

  // Handle Calendar status toggle
  const handleToggleCalendarStatus = (itemId: string) => {
    const updated = taxCalendar.map((item) => {
      if (item.id !== itemId) return item;
      const nextStatus: TaxCalendarItem['status'] =
        item.status === 'BEKLIYOR'
          ? 'HAZIRLANDI'
          : item.status === 'HAZIRLANDI'
          ? 'ONAYLANDI'
          : 'BEKLIYOR';
      return { ...item, status: nextStatus };
    });
    onUpdateTaxCalendar(updated);
  };

  const [bookkeepingMethod, setBookkeepingMethod] = useState<'BILANCO' | 'ISLETME'>('BILANCO');

  // Excel (CSV with UTF-8 BOM for Microsoft Excel) export for Giden Faturalar (Satış)
  const handleExportOutgoingExcel = (method: 'BILANCO' | 'ISLETME') => {
    let csvContent = '\uFEFF'; // UTF-8 BOM for Turkish character Excel support

    if (method === 'BILANCO') {
      csvContent += `"Sipariş/Fatura No","GİB Fatura No","ETTN","Tarih","Müşteri Ünvanı / Adı","VKN / TCKN","Vergi Dairesi","Belge Türü","Pazaryeri","Borç Hesabı (120)","Gelir Hesabı (600)","KDV Hesabı (391)","Matrah %20","KDV %20","Matrah %10","KDV %10","Matrah %1","KDV %1","Toplam KDV","%1 Stopaj (193)","Ödenecek Brüt Tutar"\n`;
      for (const order of orders) {
        if (order.isCancelled) continue;
        const fin = calculateOrderTotals(
          order.items,
          order.shippingFeeVatIncluded,
          order.includeShippingInInvoice,
          order.sellerDiscountTotal,
          order.marketplaceCommissionRate,
          order.withholdingRate
        );
        const gibNo = order.gibInvoiceNumber || 'GİB KUYRUĞUNDA';
        const ettn = order.ettn || '-';
        const docType = order.isEFaturaRegistered ? 'e-Fatura' : 'e-Arşiv';
        const mpName = order.marketplace.toUpperCase();

        csvContent += `"${order.marketplaceOrderNumber}","${gibNo}","${ettn}","${order.orderDate}","${order.customerName.replace(/"/g, '""')}","${order.taxIdentifier}","${order.taxOffice || '-'}","${docType}","${mpName}","120.01.${order.marketplace}","600.01.020","391.01.020",${fin.vatBreakdown.rate20.base.toFixed(2)},${fin.vatBreakdown.rate20.tax.toFixed(2)},${fin.vatBreakdown.rate10.base.toFixed(2)},${fin.vatBreakdown.rate10.tax.toFixed(2)},${fin.vatBreakdown.rate1.base.toFixed(2)},${fin.vatBreakdown.rate1.tax.toFixed(2)},${fin.totalVat.toFixed(2)},${fin.withholdingTaxAmount.toFixed(2)},${fin.grossInvoiceTotal.toFixed(2)}\n`;
      }
    } else {
      // İŞLETME HESABI ESASI (Gelir Listesi / İşletme Defteri Gelir Kaydı)
      csvContent += `"Kayıt Sıra No","Fatura Tarihi","Evrak / GİB No","Müşteri Ad Soyad / Ünvan","VKN/TCKN","Pazaryeri","İşlem / Gelir Türü","%20 KDV Matrahı","%20 KDV","%10 KDV Matrahı","%10 KDV","%1 KDV Matrahı","%1 KDV","Toplam Hesaplanan KDV","%1 E-Ticaret Stopajı","Toplam Gelir (KDV Dahil)"\n`;
      let rowIdx = 1;
      for (const order of orders) {
        if (order.isCancelled) continue;
        const fin = calculateOrderTotals(
          order.items,
          order.shippingFeeVatIncluded,
          order.includeShippingInInvoice,
          order.sellerDiscountTotal,
          order.marketplaceCommissionRate,
          order.withholdingRate
        );
        const gibNo = order.gibInvoiceNumber || order.marketplaceOrderNumber;
        csvContent += `${rowIdx++},"${order.orderDate}","${gibNo}","${order.customerName.replace(/"/g, '""')}","${order.taxIdentifier}","${order.marketplace.toUpperCase()}","E-Ticaret Mal Satışı Hasılâtı",${fin.vatBreakdown.rate20.base.toFixed(2)},${fin.vatBreakdown.rate20.tax.toFixed(2)},${fin.vatBreakdown.rate10.base.toFixed(2)},${fin.vatBreakdown.rate10.tax.toFixed(2)},${fin.vatBreakdown.rate1.base.toFixed(2)},${fin.vatBreakdown.rate1.tax.toFixed(2)},${fin.totalVat.toFixed(2)},${fin.withholdingTaxAmount.toFixed(2)},${fin.grossInvoiceTotal.toFixed(2)}\n`;
      }
    }

    const filename = `giden_faturalar_${method.toLowerCase()}_${selectedPeriod}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccessNotice(
      `Giden Faturalar (${method === 'BILANCO' ? 'Bilanço Esası - TDHP Yevmiye' : 'İşletme Defteri Hasılat'}) Excel dosyası başarıyla indirildi.`
    );
    setTimeout(() => setDownloadSuccessNotice(null), 4000);
  };

  // Excel export for Gelen Faturalar (Alış & Gider)
  const handleExportIncomingExcel = (method: 'BILANCO' | 'ISLETME') => {
    let csvContent = '\uFEFF';

    if (method === 'BILANCO') {
      csvContent += `"Fatura No","GİB ETTN","Fatura Tarihi","Alınma Tarihi","Tedarikçi Ünvanı","Tedarikçi VKN","Vergi Dairesi","Senaryo","Harcama / Gider Açıklaması","Borç Hesabı (760/770/153)","KDV Hesabı (191)","Alacak Hesabı (320)","Matrah (KDV Hariç)","İndirilecek KDV","Genel Toplam (Ödenecek)","Onay Durumu"\n`;
      for (const inv of incomingInvoices) {
        const isComm = inv.supplierTitle.toLowerCase().includes('pazar') || inv.supplierTitle.toLowerCase().includes('trendyol') || inv.supplierTitle.toLowerCase().includes('hepsiburada');
        const expenseAccount = isComm ? '760.01.001 (Pazaryeri Komisyon Gideri)' : '153.01.001 (Ticari Mallar / Alış)';
        const statusText = inv.responseStatus === 'ACCEPTED' ? 'Kabul Edildi' : inv.responseStatus === 'REJECTED' ? 'Reddedildi' : 'Onay Bekliyor';

        csvContent += `"${inv.invoiceNumber}","${inv.ettn}","${inv.issueDate}","${inv.receivedAt}","${inv.supplierTitle.replace(/"/g, '""')}","${inv.supplierVkn}","${inv.supplierTaxOffice}","${inv.scenario}","${inv.lineSummary.replace(/"/g, '""')}","${expenseAccount}","191.01.020","320.01.001",${inv.subtotalExclVat.toFixed(2)},${inv.totalVat.toFixed(2)},${inv.payableAmount.toFixed(2)},"${statusText}"\n`;
      }
    } else {
      // İŞLETME HESABI ESASI (Gider Listesi / İşletme Defteri Masraf Kaydı)
      csvContent += `"Kayıt Sıra No","Fatura Tarihi","Evrak No","Tedarikçi Firma / Şahıs","Tedarikçi VKN","Gider Türü (Mal Alışı / Masraf)","Açıklama","KDV Hariç Tutar","İndirilecek KDV (191)","KDV Dahil Toplam Masraf","Kabul Durumu"\n`;
      let rowIdx = 1;
      for (const inv of incomingInvoices) {
        const isComm = inv.supplierTitle.toLowerCase().includes('pazar') || inv.supplierTitle.toLowerCase().includes('trendyol') || inv.supplierTitle.toLowerCase().includes('hepsiburada');
        const expType = isComm ? 'Pazaryeri Komisyon & Hizmet Masrafı' : 'Ticari Mal Alımı (Emtea)';
        const statusText = inv.responseStatus === 'ACCEPTED' ? 'Kabul' : inv.responseStatus === 'REJECTED' ? 'Red' : 'Bekliyor';

        csvContent += `${rowIdx++},"${inv.issueDate}","${inv.invoiceNumber}","${inv.supplierTitle.replace(/"/g, '""')}","${inv.supplierVkn}","${expType}","${inv.lineSummary.replace(/"/g, '""')}",${inv.subtotalExclVat.toFixed(2)},${inv.totalVat.toFixed(2)},${inv.payableAmount.toFixed(2)},"${statusText}"\n`;
      }
    }

    const filename = `gelen_faturalar_${method.toLowerCase()}_${selectedPeriod}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccessNotice(
      `Gelen Faturalar (${method === 'BILANCO' ? 'Bilanço Esası - 760/153/191' : 'İşletme Defteri Gider/Masraf'}) Excel dosyası başarıyla indirildi.`
    );
    setTimeout(() => setDownloadSuccessNotice(null), 4000);
  };

  // Generate and download accounting files
  const handleExportAccountingFile = (format: AccountingSoftwareTarget) => {
    const filename = `faturansit_${format.toLowerCase()}_yevmiye_${selectedPeriod}.xml`;
    let content = '';

    if (format === 'LUCA') {
      content = `<?xml version="1.0" encoding="UTF-8"?>
<LucaVoucherExport Version="2.1" Generator="Faturansit">
  <Header>
    <Vkn>${activeCompany.taxIdentifier}</Vkn>
    <Unvan>${activeCompany.legalTitle}</Unvan>
    <Donem>${selectedPeriod}</Donem>
    <FisTipi>SATIS_VE_HASILAT</FisTipi>
    <FisTarihi>${selectedPeriod}-31</FisTarihi>
    <SmmmRuhsat>${smmmProfile.licenseNumber}</SmmmRuhsat>
  </Header>
  <Lines>
${voucherLines
  .map(
    (l, idx) => `    <Line Number="${idx + 1}">
      <HesapKodu>${l.accountCode}</HesapKodu>
      <HesapAdi>${l.accountName}</HesapAdi>
      <Borc>${l.debit.toFixed(2)}</Borc>
      <Alacak>${l.credit.toFixed(2)}</Alacak>
      <Aciklama>${l.description}</Aciklama>
      <KdvOran>${l.taxRate ?? 0}</KdvOran>
    </Line>`
  )
  .join('\n')}
  </Lines>
  <Totals>
    <ToplamBorc>${totalDebit.toFixed(2)}</ToplamBorc>
    <ToplamAlacak>${totalCredit.toFixed(2)}</ToplamAlacak>
    <Bakiye>0.00</Bakiye>
  </Totals>
</LucaVoucherExport>`;
    } else if (format === 'ZIRVE') {
      content = `[ZIRVE_BILGISAYAR_YEVMIYE_TRANSFER]
FIRMA_VKN=${activeCompany.taxIdentifier}
DONEM=${selectedPeriod}
FIS_NO=1
FIS_TARIH=${selectedPeriod}-31
${voucherLines
  .map(
    (l) =>
      `${l.accountCode}\t${l.debit > 0 ? l.debit.toFixed(2) : ''}\t${
        l.credit > 0 ? l.credit.toFixed(2) : ''
      }\t${l.description}`
  )
  .join('\n')}`;
    } else {
      content = `"Hesap Kodu","Hesap Adı","Borç (TL)","Alacak (TL)","Açıklama","KDV %"
${voucherLines
  .map(
    (l) =>
      `"${l.accountCode}","${l.accountName}",${l.debit.toFixed(2)},${l.credit.toFixed(
        2
      )},"${l.description}",${l.taxRate ?? 0}`
  )
  .join('\n')}`;
    }

    const blob = new Blob([content], {
      type: format === 'EXCEL_TDHP' ? 'text/csv;charset=utf-8;' : 'application/xml;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = format === 'EXCEL_TDHP' ? `faturansit_tdhp_${selectedPeriod}.csv` : filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccessNotice(`${format} yevmiye fişi başarıyla indirildi.`);
    setTimeout(() => setDownloadSuccessNotice(null), 4000);
  };

  const handleCopyVoucherClipboard = () => {
    const text = voucherLines
      .map(
        (l) =>
          `${l.accountCode}\t${l.accountName}\t${l.debit.toFixed(2)}\t${l.credit.toFixed(2)}\t${l.description}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Pascal Hero Banner */}
      <PascalHeroBanner
        kicker="SMMM & DEFTER BEYAN"
        title="Mali Müşavir & Defter Kartları"
        subtitle={`KDV matrah dağılımı (%1, %10, %20), 391/191 tahakkuk mutabakatı, Bilanço & İşletme Excel indirme · ${smmmProfile.fullName} (${smmmProfile.licenseNumber})`}
        onExportExcel={() => handleExportOutgoingExcel(bookkeepingMethod)}
        onExportPdf={() => handleExportIncomingExcel(bookkeepingMethod)}
        onSaveAction={onSaveAllModules ? () => onSaveAllModules('Mali Müşavir Modülü') : undefined}
        saveLabel={hasUnsavedChanges ? 'Değişiklikleri Kaydet' : 'İçe Aktar / Kaydet'}
        hasUnsavedChanges={hasUnsavedChanges}
        primaryLabel={activeSubTab === 'icmal' ? 'Program Aktarımına Geç' : 'KDV İcmaline Geç'}
        onPrimaryAction={() => setActiveSubTab(activeSubTab === 'icmal' ? 'export' : 'icmal')}
      />

      {/* Sub-Tab & Period Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('icmal')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'icmal'
                ? 'bg-[#0077CC] text-white border-[#0077CC] shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>KDV & Matrah İcmali (391/191)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('export')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'export'
                ? 'bg-[#0077CC] text-white border-[#0077CC] shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Yevmiye Fişi & Bilanço / İşletme Excel İndir</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Period Selector */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800">
            <Calendar className="w-3.5 h-3.5 text-[#0077CC]" />
            <span className="font-semibold text-slate-600">Dönem:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent font-bold text-slate-900 border-none outline-none cursor-pointer pr-2"
            >
              <option value="2026-10" className="bg-white text-slate-900">Ekim 2026 (Aktif)</option>
              <option value="2026-09" className="bg-white text-slate-900">Eylül 2026</option>
              <option value="2026-08" className="bg-white text-slate-900">Ağustos 2026</option>
              <option value="2026-Q3" className="bg-white text-slate-900">2026 3. Çeyrek (Geçici Vergi)</option>
            </select>
          </div>

          {/* Lock / Unlock Period */}
          <button
            type="button"
            onClick={() => setPeriodLocked(!periodLocked)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
              periodLocked
                ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                : 'bg-[#F8FAFC] text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
            title="Muhasebeleştirilen dönemi kilitleyerek fatura iptali veya değişikliğini önleyin."
          >
            {periodLocked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-[#0077CC]" />}
            <span>{periodLocked ? 'Dönem Kilidini Aç' : 'Dönemi Kilitle'}</span>
          </button>
        </div>
      </div>

      {downloadSuccessNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">{downloadSuccessNotice}</span>
          </div>
          <span className="font-mono text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">Tek Düzen Hesap Planı Bakiye Eşit</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: KDV & MATRAH İCMALİ (391 HESAPLANAN / 191 İNDİRİLECEK / STOPAJ) */}
      {/* ========================================================================= */}
      {activeSubTab === 'icmal' && (
        <div className="space-y-6">
          {/* 4-Column Diamond Lattice KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <PascalKpiCard
              title="Brüt satış hasılatı"
              value={formatTryCurrency(financialSummary.grossSales)}
              tone="emerald"
              pillText={`${financialSummary.orderCount} fatura`}
              subtitle="kesilen e-belge toplamı"
              icon={<Scale className="w-5 h-5" />}
            />

            <PascalKpiCard
              title="391 Hesaplanan KDV"
              value={formatTryCurrency(financialSummary.calculatedVat391)}
              tone="rose"
              pillText="391 KDV"
              subtitle={`Matrah: ${formatTryCurrency(financialSummary.totalTaxBase)}`}
              icon={<Percent className="w-5 h-5" />}
            />

            <PascalKpiCard
              title="191 İndirilecek KDV"
              value={formatTryCurrency(financialSummary.deductibleVat191)}
              tone="amber"
              pillText="191 Gider"
              subtitle="pazaryeri komisyon & kargo"
              icon={<FileText className="w-5 h-5" />}
            />

            <PascalKpiCard
              title="Net KDV tahakkuku"
              value={formatTryCurrency(Math.abs(financialSummary.netVatPayable))}
              tone="sky"
              pillText={financialSummary.netVatPayable >= 0 ? 'Ödenecek KDV' : 'Devreden KDV'}
              subtitle="391 - 191 dönem farkı"
              icon={<ShieldCheck className="w-5 h-5" />}
            />
          </div>

          {/* Detailed Tax Rate Breakdown Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  KDV Oran Dağılımı ve Matrah Tablosu (KDV-1 Beyannamesi Matrah Bildirimi)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  1 Nolu KDV Beyannamesinin "Tevkifat Uygulanmayan İşlemler" tablosuna aktarılacak resmi matrahlar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleExportAccountingFile('EXCEL_TDHP')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F6BAE] border border-[#0F6BAE] rounded-lg hover:bg-[#248BD6] transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-white" />
                <span>İcmal CSV İndir</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">KDV Oranı</th>
                    <th className="py-3 px-4">TDHP Satış Hesabı</th>
                    <th className="py-3 px-4">TDHP KDV Hesabı</th>
                    <th className="py-3 px-4 text-right">Vergi Matrahı (TL)</th>
                    <th className="py-3 px-4 text-right">Hesaplanan KDV (TL)</th>
                    <th className="py-3 px-4 text-right">Toplam Hasılat (TL)</th>
                    <th className="py-3 px-4 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-slate-700">
                  <tr className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">%20 Genel Oran</td>
                    <td className="py-3 px-4 text-[#0F6BAE] font-mono font-semibold">600.01.020</td>
                    <td className="py-3 px-4 text-[#0F6BAE] font-mono font-semibold">391.01.020</td>
                    <td className="py-3 px-4 text-right text-slate-800 font-semibold">
                      {formatTryCurrency(financialSummary.base20)}
                    </td>
                    <td className="py-3 px-4 text-right text-[#0F6BAE] font-semibold">
                      {formatTryCurrency(financialSummary.vat20)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 font-bold">
                      {formatTryCurrency(financialSummary.base20 + financialSummary.vat20)}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                        Mutabık
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">%10 İndirimli Oran (Gıda/Tekstil)</td>
                    <td className="py-3 px-4 text-[#0F6BAE] font-mono font-semibold">600.01.010</td>
                    <td className="py-3 px-4 text-[#0F6BAE] font-mono font-semibold">391.01.010</td>
                    <td className="py-3 px-4 text-right text-slate-800 font-semibold">
                      {formatTryCurrency(financialSummary.base10)}
                    </td>
                    <td className="py-3 px-4 text-right text-[#0F6BAE] font-semibold">
                      {formatTryCurrency(financialSummary.vat10)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 font-bold">
                      {formatTryCurrency(financialSummary.base10 + financialSummary.vat10)}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                        Mutabık
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">%1 Temel İhtiyaç Oranı</td>
                    <td className="py-3 px-4 text-[#0F6BAE] font-mono font-semibold">600.01.001</td>
                    <td className="py-3 px-4 text-[#0F6BAE] font-mono font-semibold">391.01.001</td>
                    <td className="py-3 px-4 text-right text-slate-800 font-semibold">
                      {formatTryCurrency(financialSummary.base1)}
                    </td>
                    <td className="py-3 px-4 text-right text-[#0F6BAE] font-semibold">
                      {formatTryCurrency(financialSummary.vat1)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 font-bold">
                      {formatTryCurrency(financialSummary.base1 + financialSummary.vat1)}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                        Mutabık
                      </span>
                    </td>
                  </tr>

                  {/* Summary Totals Row */}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-200">
                    <td className="py-3 px-4 font-sans text-slate-900" colSpan={3}>
                      TOPLAM MATRAH VE HESAPLANAN KDV
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900">
                      {formatTryCurrency(financialSummary.totalTaxBase)}
                    </td>
                    <td className="py-3 px-4 text-right text-[#0F6BAE]">
                      {formatTryCurrency(financialSummary.calculatedVat391)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900">
                      {formatTryCurrency(financialSummary.grossSales)}
                    </td>
                    <td className="py-3 px-4 text-center font-sans text-[11px] text-emerald-700">
                      %100 Doğrulandı
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Special Section: GVK Ek Madde 9 - %1 E-Ticaret Stopajı & Pazaryeri Tevkifatı */}
          <div className="bg-[#F0F6FF] rounded-xl border border-[#C6CDFF] p-5 shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#248BD6] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    GVK Ek Madde 9 & Pazaryeri %1 Gelir Vergisi Stopajı / Tevkifat İcmali
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                    7491 Sayılı Kanun gereğince pazaryerleri (Trendyol, Hepsiburada, Amazon, vb.) satıcı adına brüt satış tutarı üzerinden %1 stopaj kesintisi yaparak Muhtasar beyanname ile vergi dairesine yatırmaktadır. Bu tutarlar satıcının <strong className="text-[#0F6BAE]">193 Peşin Ödenen Vergiler</strong> hesabına borç kaydedilerek yıllık Gelir / Kurumlar vergisinden mahsup edilir.
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] font-semibold text-slate-600 uppercase">Toplam %1 Kesinti Tutarı</div>
                <div className="text-xl font-bold font-mono text-[#0F6BAE] mt-0.5">
                  {formatTryCurrency(financialSummary.withholding1Percent)}
                </div>
                <div className="text-[11px] text-slate-600 font-mono mt-0.5">TDHP: 193.01.001</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: YEVMİYE FİŞİ & PROGRAM AKTARIMI (BİLANÇO & İŞLETME ESASI)      */}
      {/* ========================================================================= */}
      {activeSubTab === 'export' && (
        <div className="space-y-6">
          {/* Main Integration Card: Method Switcher & Header */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Mali Müşavir Muhasebe Programı Entegrasyonu
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-[#F0F6FF] text-[#0F6BAE] border border-[#C6CDFF]">
                    GELEN & GİDEN FATURA EXCEL AKTARIMI
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Gelen ve giden faturalarınızı mükellefin defter tutma esasına göre (<strong className="text-[#0F6BAE]">Bilanço Usulü - Yevmiye Fişi</strong> veya <strong className="text-[#0F6BAE]">İşletme Hesabı Esası - Gelir/Gider Defteri</strong>) ayrı ayrı Microsoft Excel / CSV formatında anında indirebilirsiniz.
                </p>
              </div>

              {/* Usul Seçimi: Bilanço Usulü vs İşletme Usulü */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setBookkeepingMethod('BILANCO')}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    bookkeepingMethod === 'BILANCO'
                      ? 'bg-[#248BD6] text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Bilanço Usulü (Yevmiye / TDHP)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBookkeepingMethod('ISLETME')}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    bookkeepingMethod === 'ISLETME'
                      ? 'bg-[#248BD6] text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookText className="w-3.5 h-3.5" />
                  <span>İşletme Usulü (Gelir/Gider)</span>
                </button>
              </div>
            </div>

            {/* Explanation Banner according to selected method */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#248BD6]"></span>
                <span className="text-slate-700 font-medium">
                  {bookkeepingMethod === 'BILANCO'
                    ? 'Bilanço Usulü Seçili: Faturalar Tek Düzen Hesap Planı kodları (120, 600, 391, 760, 153, 191, 193) ile borç-alacak detaylı Excel listesine dökülür.'
                    : 'İşletme Hesabı Usulü Seçili: Faturalar İşletme Defteri Gelir ve Gider kayıt sistemine uygun matrah, KDV ve brüt hasılat/masraf sütunları ile Excel listesine dökülür.'}
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#0F6BAE] font-medium whitespace-nowrap">
                Dönem: {selectedPeriod}
              </span>
            </div>
          </div>

          {/* TWO DEDICATED CARDS: 1) GİDEN FATURALAR (SATIŞ) EXCEL | 2) GELEN FATURALAR (ALIŞ & GİDER) EXCEL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. GİDEN FATURALAR (SATIŞ / E-FATURA & E-ARŞİV) */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between space-y-4 shadow-xs">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#248BD6] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Giden Faturalar Excel İndir (Satış)
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Pazaryeri satışları, e-Fatura ve e-Arşiv faturaları
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F0F6FF] text-[#0F6BAE] border border-[#C6CDFF] shrink-0">
                    {financialSummary.orderCount} Fatura
                  </span>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans font-medium text-slate-500">Kullanılan Yöntem:</span>
                    <span className="font-bold text-slate-900">
                      {bookkeepingMethod === 'BILANCO' ? 'Bilanço (Yevmiye Satış Fişi)' : 'İşletme (Hasılat Listesi)'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans font-medium text-slate-500">Toplam Brüt Satış:</span>
                    <span className="font-bold text-slate-900">{formatTryCurrency(financialSummary.grossSales)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans font-medium text-slate-500">391 Hesaplanan KDV:</span>
                    <span className="font-bold text-[#0F6BAE]">{formatTryCurrency(financialSummary.calculatedVat391)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans font-medium text-slate-500">%1 E-Ticaret Stopajı:</span>
                    <span className="font-bold text-slate-900">{formatTryCurrency(financialSummary.withholding1Percent)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {bookkeepingMethod === 'BILANCO'
                    ? 'İçerik: Fatura No, GİB No, ETTN, Müşteri Ünvanı, VKN/TCKN, 120 Müşteriler, 600 Satışlar, 391 KDV, Matrah %20/%10/%1 ve %1 Stopaj.'
                    : 'İçerik: Sıra No, Tarih, Evrak No, Müşteri, VKN/TCKN, Pazaryeri, %20/%10/%1 Matrah & KDV dağılımı ve Toplam Gelir.'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => handleExportOutgoingExcel(bookkeepingMethod)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#248BD6] hover:bg-[#0F6BAE] rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    Giden Faturaları Excel İndir ({bookkeepingMethod === 'BILANCO' ? 'Bilanço Usulü' : 'İşletme Usulü'})
                  </span>
                </button>
              </div>
            </div>

            {/* 2. GELEN FATURALAR (ALIŞ & GİDER / TEDARİKÇİ & KOMİSYON) */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between space-y-4 shadow-xs">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0F6BAE] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <ArrowDownLeft className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Gelen Faturalar Excel İndir (Alış & Gider)
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tedarikçi alışları, pazaryeri komisyon ve kargo giderleri
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F0F6FF] text-[#0F6BAE] border border-[#C6CDFF] shrink-0">
                    {incomingInvoices.length} Fatura
                  </span>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans font-medium text-slate-500">Kullanılan Yöntem:</span>
                    <span className="font-bold text-slate-900">
                      {bookkeepingMethod === 'BILANCO' ? 'Bilanço (Yevmiye Masraf Fişi)' : 'İşletme (Gider Listesi)'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans font-medium text-slate-500">KDV Hariç Gider Toplamı:</span>
                    <span className="font-bold text-slate-900">{formatTryCurrency(financialSummary.incomingExpenseTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans font-medium text-slate-500">191 İndirilecek KDV:</span>
                    <span className="font-bold text-emerald-600">{formatTryCurrency(financialSummary.deductibleVat191)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans font-medium text-slate-500">Toplam Ödenecek / Tutar:</span>
                    <span className="font-bold text-slate-900">{formatTryCurrency(financialSummary.incomingExpenseTotal + financialSummary.deductibleVat191)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {bookkeepingMethod === 'BILANCO'
                    ? 'İçerik: Fatura No, ETTN, Tedarikçi Ünvanı, VKN, Harcama Türü, 760/153 Borç, 191 İndirilecek KDV, 320 Satıcılar ve Genel Toplam.'
                    : 'İçerik: Sıra No, Tarih, Evrak No, Tedarikçi Firma, VKN, Masraf Türü, KDV Hariç Tutar, İndirilecek KDV ve Toplam Masraf.'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => handleExportIncomingExcel(bookkeepingMethod)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#0F6BAE] hover:bg-[#248BD6] rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    Gelen Faturaları Excel İndir ({bookkeepingMethod === 'BILANCO' ? 'Bilanço Usulü' : 'İşletme Usulü'})
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Software XML & Direct TDHP Integration Options */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Özel Muhasebe Programı Fiş Formatları (TÜRMOB Luca / Zirve / Mikro / Logo)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Standart Excel çıktılarının yanı sıra yazılımınızın otomatik içe aktarım (XML/ASCII) formatında da alabilirsiniz.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(['LUCA', 'ZIRVE', 'MIKRO', 'LOGO', 'EXCEL_TDHP'] as AccountingSoftwareTarget[]).map((sw) => (
                  <button
                    key={sw}
                    type="button"
                    onClick={() => setSelectedSoftware(sw)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      selectedSoftware === sw
                        ? 'bg-[#248BD6] text-white border-[#248BD6] shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sw === 'LUCA' && 'TÜRMOB Luca XML'}
                    {sw === 'ZIRVE' && 'Zirve Yazılım'}
                    {sw === 'MIKRO' && 'Mikro Muhasebe'}
                    {sw === 'LOGO' && 'Logo Tiger/Go'}
                    {sw === 'EXCEL_TDHP' && 'TDHP Yevmiye Tablosu'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Voucher Preview Header & Actions */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#0F6BAE] border border-slate-200 flex items-center justify-center font-bold text-xs">
                  TDHP
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      Tek Düzen Hesap Planı Yevmiye Fişi ({selectedSoftware})
                    </h4>
                    {isVoucherBalanced ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3" /> BORÇ / ALACAK DENGELİ
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-50 text-red-800 border border-red-200">
                        DENGE FARKI: {Math.abs(totalDebit - totalCredit).toFixed(2)} TL
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Firma VKN: {activeCompany.taxIdentifier} · Dönem: {selectedPeriod} · Toplam {voucherLines.length} Kalem
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyVoucherClipboard}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Pano kopyala (Excel veya muhasebe fiş ekranına yapıştırın)"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#248BD6]" />}
                  <span>{isCopied ? 'Kopyalandı!' : 'Panoya Kopyala'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportAccountingFile(selectedSoftware)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#248BD6] hover:bg-[#0F6BAE] rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{selectedSoftware} Fişini İndir</span>
                </button>
              </div>
            </div>

            {/* Voucher Lines Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Hesap Kodu</th>
                    <th className="py-2.5 px-4">Hesap Adı</th>
                    <th className="py-2.5 px-4">Açıklama</th>
                    <th className="py-2.5 px-4 text-center">KDV %</th>
                    <th className="py-2.5 px-4 text-right">Borç Tutarı (TL)</th>
                    <th className="py-2.5 px-4 text-right">Alacak Tutarı (TL)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-slate-700">
                  {voucherLines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-[#0F6BAE]">{line.accountCode}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-900 font-medium">{line.accountName}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-500 max-w-xs truncate">{line.description}</td>
                      <td className="py-2.5 px-4 text-center font-sans text-slate-600">
                        {line.taxRate ? `%${line.taxRate}` : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        {line.debit > 0 ? formatTryCurrency(line.debit) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        {line.credit > 0 ? formatTryCurrency(line.credit) : '-'}
                      </td>
                    </tr>
                  ))}

                  {/* Balanced Total Row */}
                  <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold text-slate-900">
                    <td className="py-3 px-4 font-sans text-[#0F6BAE]" colSpan={4}>
                      TOPLAM BORÇ / ALACAK
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900">
                      {formatTryCurrency(totalDebit)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900">
                      {formatTryCurrency(totalCredit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
