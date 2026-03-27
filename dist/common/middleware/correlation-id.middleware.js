"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorrelationIdMiddleware = exports.CORRELATION_ID_HEADER = void 0;
const crypto_1 = require("crypto");
exports.CORRELATION_ID_HEADER = 'x-request-id';
class CorrelationIdMiddleware {
    static generate(req, res, next) {
        const incomingId = req.headers[exports.CORRELATION_ID_HEADER] ??
            req.headers['x-correlation-id'];
        const correlationId = incomingId || (0, crypto_1.randomUUID)();
        req.correlationId = correlationId;
        res.setHeader(exports.CORRELATION_ID_HEADER, correlationId);
        next();
    }
}
exports.CorrelationIdMiddleware = CorrelationIdMiddleware;
//# sourceMappingURL=correlation-id.middleware.js.map