import dayjs from 'dayjs';

export function daysBetween(start, end) {
  // inclusive days calc
  const s = dayjs(start).startOf('day');
  const e = dayjs(end).startOf('day');
  return e.diff(s, 'day') + 1;
}

export function proratedAmountMonthly(amountMonthly, periodStart, periodEnd) {
  // assume 30-day month for simplicity (industry common) or use real month length:
  const days = daysBetween(periodStart, periodEnd);
  const perDay = amountMonthly / 30;
  return { days, prorated: perDay * days };
}

export function isExpired(expiryDate) {
  return expiryDate ? dayjs(expiryDate).endOf('day').isBefore(dayjs()) : false;
}
