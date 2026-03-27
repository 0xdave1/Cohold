"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestmentController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const investment_service_1 = require("./investment.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const create_fractional_investment_dto_1 = require("./dto/create-fractional-investment.dto");
let InvestmentController = class InvestmentController {
    constructor(investmentService) {
        this.investmentService = investmentService;
    }
    async createFractional(user, dto) {
        return this.investmentService.createFractional(user.id, dto);
    }
    async getById(id) {
        return this.investmentService.getInvestment(id);
    }
    async getByUser(userId, page = '1', limit = '20') {
        return this.investmentService.getInvestmentsByUser(userId, parseInt(page, 10), parseInt(limit, 10));
    }
};
exports.InvestmentController = InvestmentController;
__decorate([
    (0, common_1.Post)('fractional'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_fractional_investment_dto_1.CreateFractionalInvestmentDto]),
    __metadata("design:returntype", Promise)
], InvestmentController.prototype, "createFractional", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InvestmentController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('userId')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], InvestmentController.prototype, "getByUser", null);
exports.InvestmentController = InvestmentController = __decorate([
    (0, swagger_1.ApiTags)('investments'),
    (0, swagger_1.ApiBearerAuth)('user-jwt'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('investments'),
    __metadata("design:paramtypes", [investment_service_1.InvestmentService])
], InvestmentController);
//# sourceMappingURL=investment.controller.js.map