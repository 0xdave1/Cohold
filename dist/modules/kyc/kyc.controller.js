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
exports.KycController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const kyc_service_1 = require("./kyc.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const admin_jwt_guard_1 = require("../../common/guards/admin-jwt.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const submit_bvn_dto_1 = require("./dto/submit-bvn.dto");
const kyc_review_dto_1 = require("./dto/kyc-review.dto");
let KycController = class KycController {
    constructor(kycService) {
        this.kycService = kycService;
    }
    async submitBvn(user, dto) {
        return this.kycService.submitBvn(user.id, dto);
    }
    async approve(admin, userId, dto) {
        return this.kycService.approveKyc(admin.id, userId, dto);
    }
    async reject(admin, userId, dto) {
        return this.kycService.rejectKyc(admin.id, userId, dto);
    }
};
exports.KycController = KycController;
__decorate([
    (0, swagger_1.ApiBearerAuth)('user-jwt'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('kyc/bvn'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, submit_bvn_dto_1.SubmitBvnDto]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "submitBvn", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('admin-jwt'),
    (0, common_1.UseGuards)(admin_jwt_guard_1.AdminJwtGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.APPROVER, client_1.AdminRole.SUPER_ADMIN),
    (0, common_1.Patch)('admin/users/:id/kyc-approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, kyc_review_dto_1.KycReviewDto]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "approve", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('admin-jwt'),
    (0, common_1.UseGuards)(admin_jwt_guard_1.AdminJwtGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.APPROVER, client_1.AdminRole.SUPER_ADMIN),
    (0, common_1.Patch)('admin/users/:id/kyc-reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, kyc_review_dto_1.KycReviewDto]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "reject", null);
exports.KycController = KycController = __decorate([
    (0, swagger_1.ApiTags)('kyc'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [kyc_service_1.KycService])
], KycController);
//# sourceMappingURL=kyc.controller.js.map