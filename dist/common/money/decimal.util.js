"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDecimal = toDecimal;
exports.formatMoney = formatMoney;
exports.formatHighPrecision = formatHighPrecision;
const decimal_js_1 = require("decimal.js");
decimal_js_1.default.set({
    precision: 24,
    rounding: decimal_js_1.default.ROUND_HALF_EVEN,
});
function toDecimal(value) {
    if (value instanceof decimal_js_1.default) {
        return value;
    }
    if (typeof value === 'number') {
        return new decimal_js_1.default(value.toString());
    }
    return new decimal_js_1.default(value);
}
function formatMoney(value) {
    return value.toFixed(4);
}
function formatHighPrecision(value) {
    return value.toFixed(8);
}
//# sourceMappingURL=decimal.util.js.map