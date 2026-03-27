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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const admin_service_1 = require("./admin.service");
const admin_jwt_guard_1 = require("../../common/guards/admin-jwt.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const class_validator_1 = require("class-validator");
class DistributionBatchDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DistributionBatchDto.prototype, "propertyId", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], DistributionBatchDto.prototype, "totalAmount", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.Currency),
    __metadata("design:type", String)
], DistributionBatchDto.prototype, "currency", void 0);
let AdminController = class AdminController {
    constructor(adminService) {
        this.adminService = adminService;
    }
    async overview() {
        return this.adminService.getDashboardOverview();
    }
    async listUsers(page = '1', limit = '20', kycStatus) {
        return this.adminService.listUsers({
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            kycStatus,
        });
    }
    async distributionBatch(admin, dto) {
        return this.adminService.createDistributionBatch(admin.id, dto.propertyId, dto.totalAmount, dto.currency);
    }
    async complianceReport() {
        return this.adminService.getComplianceReport();
    }
    async activityLog(page = '1', limit = '50') {
        return this.adminService.getActivityLog(parseInt(page, 10), parseInt(limit, 10));
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, roles_decorator_1.Roles)(client_1.AdminRole.DATA_UPLOADER, client_1.AdminRole.APPROVER, client_1.AdminRole.SUPER_ADMIN),
    (0, common_1.Get)('dashboard/overview'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "overview", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.AdminRole.DATA_UPLOADER, client_1.AdminRole.APPROVER, client_1.AdminRole.SUPER_ADMIN),
    (0, common_1.Get)('users'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('kycStatus')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listUsers", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.AdminRole.APPROVER, client_1.AdminRole.SUPER_ADMIN),
    (0, common_1.Post)('distributions/batch'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, DistributionBatchDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "distributionBatch", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.AdminRole.APPROVER, client_1.AdminRole.SUPER_ADMIN),
    (0, common_1.Get)('reports/compliance'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "complianceReport", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.AdminRole.DATA_UPLOADER, client_1.AdminRole.APPROVER, client_1.AdminRole.SUPER_ADMIN),
    (0, common_1.Get)('activity-log'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "activityLog", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, swagger_1.ApiBearerAuth)('admin-jwt'),
    (0, common_1.UseGuards)(admin_jwt_guard_1.AdminJwtGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('admin'),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map