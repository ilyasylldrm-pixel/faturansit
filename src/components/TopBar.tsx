import React from 'react';

export type ActiveTab =
  | 'admin'
  | 'company'
  | 'orders'
  | 'reconciliation'
  | 'marketplaces'
  | 'users'
  | 'rules';

interface TopBarProps {
  activeTab?: ActiveTab;
  onSelectTab?: (tab: ActiveTab) => void;
  onBatchInvoiceAction?: () => void;
  pendingCount?: number;
}

export const TopBar: React.FC<TopBarProps> = () => {
  return null;
};
