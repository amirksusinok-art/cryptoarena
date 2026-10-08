export function formatPrice(price: number, symbol?: string): string {
  if (isNaN(price)) return '$0.00';
  if (symbol?.startsWith('DOGE') || price < 1) {
    return `$${price.toFixed(5)}`;
  }
  if (symbol?.startsWith('TON') || price < 10) {
    return `$${price.toFixed(3)}`;
  }
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(pct: number): string {
  if (isNaN(pct)) return '0.00%';
  const prefix = pct > 0 ? '+' : '';
  return `${prefix}${pct.toFixed(2)}%`;
}

export function formatMoney(val: number): string {
  if (isNaN(val)) return '$0.00';
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatMoneyWithSign(val: number): string {
  if (isNaN(val)) return '$0.00';
  const prefix = val > 0 ? '+' : val < 0 ? '-' : '';
  return `${prefix}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCompactNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(0);
}

export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
