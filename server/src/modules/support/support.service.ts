import { HttpError } from '../../utils/http-error.js';
import type { SupportRepository } from './support.repository.js';
import {
  supportIssueTypes,
  supportStatuses,
  type SupportIssueType,
  type SupportStatus,
} from './support.types.js';

export class SupportService {
  constructor(private readonly repository: SupportRepository) {}

  async create(traineeId: number, input: unknown) {
    const body = input as { issueType?: unknown; message?: unknown } | null;
    const issueType = body?.issueType;
    const message =
      typeof body?.message === 'string' ? body.message.trim() : '';

    if (
      typeof issueType !== 'string' ||
      !supportIssueTypes.includes(issueType as SupportIssueType)
    )
      throw new HttpError(
        400,
        'Select a valid issue type.',
        'INVALID_ISSUE_TYPE',
      );
    if (!message)
      throw new HttpError(400, 'Enter a support message.', 'INVALID_MESSAGE');
    if (message.length > 1000)
      throw new HttpError(
        400,
        'Support messages must be 1,000 characters or fewer.',
        'INVALID_MESSAGE',
      );

    return {
      id: await this.repository.create(
        traineeId,
        issueType as SupportIssueType,
        message,
      ),
    };
  }

  async list() {
    const messages = await this.repository.list();
    return {
      messages: messages.map((message) => this.serialize(message)),
    };
  }

  async listForTrainee(traineeId: number) {
    const messages = await this.repository.listForTrainee(traineeId);
    return { messages: messages.map((message) => this.serialize(message)) };
  }

  async adminNotifications() {
    const notifications = await this.repository.adminNotifications();
    return {
      unreadCount: notifications.length,
      notifications: notifications.map((notification) => ({
        ...notification,
        createdAt: notification.createdAt.toISOString(),
      })),
    };
  }

  async traineeNotifications(traineeId: number) {
    const notifications = await this.repository.traineeNotifications(traineeId);
    return {
      unreadCount: notifications.length,
      notifications: notifications.map((notification) => ({
        ...notification,
        createdAt: notification.createdAt.toISOString(),
      })),
    };
  }

  async markAdminNotificationRead(id: number) {
    if (!Number.isInteger(id) || id <= 0)
      throw new HttpError(
        400,
        'Invalid support message.',
        'INVALID_MESSAGE_ID',
      );
    if (!(await this.repository.markAdminNotificationRead(id)))
      throw new HttpError(
        404,
        'Support message not found.',
        'MESSAGE_NOT_FOUND',
      );
  }

  async markTraineeNotificationRead(
    id: number,
    traineeId: number,
    respondedAt: unknown,
  ) {
    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      typeof respondedAt !== 'string' ||
      !Number.isFinite(Date.parse(respondedAt))
    )
      throw new HttpError(
        400,
        'Invalid support notification.',
        'INVALID_NOTIFICATION',
      );
    if (
      !(await this.repository.markTraineeNotificationRead(
        id,
        traineeId,
        respondedAt,
      ))
    )
      throw new HttpError(
        404,
        'Support notification not found.',
        'NOTIFICATION_NOT_FOUND',
      );
  }

  private serialize(
    message: Awaited<ReturnType<SupportRepository['list']>>[number],
  ) {
    return {
      ...message,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      respondedAt: message.respondedAt?.toISOString() ?? null,
    };
  }

  async saveResponse(id: number, administratorId: number, input: unknown) {
    if (!Number.isInteger(id) || id <= 0)
      throw new HttpError(
        400,
        'Invalid support message.',
        'INVALID_MESSAGE_ID',
      );
    const body = input as { adminResponse?: unknown } | null;
    const response =
      typeof body?.adminResponse === 'string' ? body.adminResponse.trim() : '';
    if (!response || response.length > 4000)
      throw new HttpError(
        400,
        'Enter a response of 4,000 characters or fewer.',
        'INVALID_RESPONSE',
      );
    const saved = await this.repository.saveResponse(
      id,
      administratorId,
      response,
    );
    if (!saved)
      throw new HttpError(
        404,
        'Support message not found.',
        'MESSAGE_NOT_FOUND',
      );
    return {
      id,
      adminResponse: response,
      respondedAt: saved.respondedAt.toISOString(),
      respondedBy: administratorId,
    };
  }

  async updateStatus(id: number, input: unknown) {
    if (!Number.isInteger(id) || id <= 0)
      throw new HttpError(
        400,
        'Invalid support message.',
        'INVALID_MESSAGE_ID',
      );
    const status = (input as { status?: unknown } | null)?.status;
    if (
      typeof status !== 'string' ||
      !supportStatuses.includes(status as SupportStatus)
    )
      throw new HttpError(400, 'Select a valid status.', 'INVALID_STATUS');
    if (!(await this.repository.updateStatus(id, status as SupportStatus)))
      throw new HttpError(
        404,
        'Support message not found.',
        'MESSAGE_NOT_FOUND',
      );
    return { id, status };
  }
}
