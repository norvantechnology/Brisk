import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import * as chatService from './chat.service';
import type { ChatListQuery, ChatMessagesQuery } from './chat.validation';

export const listConversations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await chatService.listConversations(
      req.user!.id,
      req.user!.role as UserRole,
      req.query as unknown as ChatListQuery
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Conversations retrieved successfully.',
      data: data.items,
      meta: data.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const listMessages = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { meta, ...data } = await chatService.listMessages(
      req.user!.id,
      req.user!.role as UserRole,
      req.params.jobId,
      req.query as unknown as ChatMessagesQuery
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Messages retrieved successfully.',
      data,
      meta,
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await chatService.sendMessage(
      req.user!.id,
      req.user!.role as UserRole,
      req.params.jobId,
      {
        message: req.body.message,
        imageUrl: req.body.imageUrl ?? null,
      }
    );
    sendResponse({
      res,
      statusCode: 201,
      message: 'Message sent successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
