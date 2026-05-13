import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SupportService } from './support.service';

describe('SupportService Issue 12 audit / isolation', () => {
  const prisma = {
    supportConversation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    supportMessage: { create: jest.fn(), updateMany: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    adminActivityLog: { create: jest.fn() },
  } as any;
  const notificationsService = { notifySystemMessage: jest.fn() } as any;
  let service: SupportService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new SupportService(prisma, notificationsService);
  });

  describe('resolveConversation', () => {
    it('rejects empty / too-short reason', async () => {
      await expect(service.resolveConversation('admin-1', 'conv-1', '   ')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.resolveConversation('admin-1', 'conv-1', 'abc')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.supportConversation.update).not.toHaveBeenCalled();
    });

    it('writes AdminActivityLog with sanitized-length reason on success', async () => {
      prisma.supportConversation.update.mockResolvedValue({ id: 'conv-1' });
      prisma.supportMessage.create.mockResolvedValue({});
      prisma.adminActivityLog.create.mockResolvedValue({});

      await service.resolveConversation('admin-1', 'conv-1', 'User issue fully addressed.');

      expect(prisma.adminActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: 'admin-1',
          action: 'SUPPORT_CONVERSATION_RESOLVED',
          entityType: 'SupportConversation',
          entityId: 'conv-1',
          reason: 'User issue fully addressed.',
          actorAdminId: 'admin-1',
          targetType: 'SupportConversation',
          targetId: 'conv-1',
        }),
      });
      expect(prisma.supportMessage.create).toHaveBeenCalled();
    });
  });

  describe('getUserConversation', () => {
    it('returns not found when conversation belongs to another user', async () => {
      prisma.supportConversation.findFirst.mockResolvedValue(null);
      await expect(service.getUserConversation('user-a', 'conv-owned-by-b')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns conversation for owner', async () => {
      prisma.supportConversation.findFirst.mockResolvedValue({
        id: 'c1',
        referenceCode: 'SUP-1',
        category: 'GENERAL',
        status: 'OPEN',
        priority: 'NORMAL',
        isDispute: false,
        subject: 'Hi',
        metadata: {},
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        assignedAdminId: null,
      });
      const row = await service.getUserConversation('user-a', 'c1');
      expect(row.id).toBe('c1');
    });
  });

  describe('assignConversation', () => {
    it('does not write AdminActivityLog (only resolve is audited today)', async () => {
      prisma.supportConversation.update.mockResolvedValue({ id: 'c1' });
      prisma.supportMessage.create.mockResolvedValue({});
      await service.assignConversation('admin-a', 'c1', 'admin-b');
      expect(prisma.adminActivityLog.create).not.toHaveBeenCalled();
    });
  });
});
