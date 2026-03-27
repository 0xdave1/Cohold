import Decimal from 'decimal.js';
export type MoneyString = string;
export declare function toDecimal(value: string | number | Decimal): Decimal;
export declare function formatMoney(value: Decimal): MoneyString;
export declare function formatHighPrecision(value: Decimal): MoneyString;
