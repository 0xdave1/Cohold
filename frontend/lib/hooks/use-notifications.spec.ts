import { describe, expect, it } from 'vitest';
import { getNotificationDeliveryView, type Notification } from '@/lib/hooks/use-notifications';

function row(metadata: unknown): Notification {
  return {
    id: 'n1',
    type: 'SYSTEM_MESSAGE',
    title: 'Title',
    message: 'Message',
    isRead: false,
    readAt: null,
    link: null,
    metadata,
    createdAt: new Date().toISOString(),
  };
}

describe('getNotificationDeliveryView', () => {
  it('does not treat pending/retrying as sent', () => {
    expect(getNotificationDeliveryView(row({ deliveryStatus: 'PENDING' })).state).toBe('EMAIL_PENDING');
    expect(getNotificationDeliveryView(row({ deliveryStatus: 'RETRYING' })).state).toBe('DELIVERY_RETRYING');
  });

  it('marks sent only for sent-like status', () => {
    expect(getNotificationDeliveryView(row({ deliveryStatus: 'SENT' })).state).toBe('EMAIL_SENT');
    expect(getNotificationDeliveryView(row({ deliveryStatus: 'EMAIL_SENT' })).state).toBe('EMAIL_SENT');
    expect(getNotificationDeliveryView(row({ deliveryStatus: 'FAILED' })).state).not.toBe('EMAIL_SENT');
  });
});
