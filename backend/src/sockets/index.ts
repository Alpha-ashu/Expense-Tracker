import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../db/prisma';

interface AuthenticatedSocket extends Socket {
  userId: string;
  deviceId: string;
}

export class SocketManager {
  private io: Server;
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds
  private userDevices = new Map<string, Set<string>>(); // userId -> Set of deviceIds

  constructor(httpServer: any) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Socket authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        // Verify token and get user info
        const user = await this.verifyToken(token);
        if (!user) {
          return next(new Error('Authentication error: Invalid token'));
        }

        socket.userId = user.id;
        socket.deviceId = socket.handshake.auth.deviceId || 'unknown';

        // Track connected users and devices
        this.trackUserConnection(user.id, socket.id, socket.deviceId);
        
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication error'));
      }
    });
  }

  private async verifyToken(token: string) {
    // This should integrate with your existing auth system
    // For now, we'll use a simple verification
    try {
      // In a real implementation, this would verify JWT tokens
      // and check against your user database
      const user = await prisma.user.findFirst({
        where: { 
          refreshTokens: {
            some: { token }
          }
        }
      });
      return user;
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  private trackUserConnection(userId: string, socketId: string, deviceId: string) {
    // Track user connections
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);

    // Track device connections
    if (!this.userDevices.has(userId)) {
      this.userDevices.set(userId, new Set());
    }
    this.userDevices.get(userId)!.add(deviceId);

    console.log(`User ${userId} connected from device ${deviceId} via socket ${socketId}`);
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId;
      const deviceId = socket.deviceId;

      console.log(`Socket connected: User ${userId}, Device ${deviceId}, Socket ${socket.id}`);

      // Join user-specific room
      socket.join(`user:${userId}`);
      
      // Join device-specific room
      socket.join(`device:${deviceId}`);

      // Handle sync requests
      socket.on('sync_request', async (data) => {
        try {
          const { lastSyncedAt, entityTypes } = data;
          
          // Get latest data for the user
          const syncData = await this.getSyncData(userId, lastSyncedAt, entityTypes);
          
          socket.emit('sync_response', {
            success: true,
            data: syncData,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('Sync request error:', error);
          socket.emit('sync_response', {
            success: false,
            error: 'Sync failed',
            timestamp: new Date().toISOString()
          });
        }
      });

      // Handle transaction updates
      socket.on('transaction_update', async (data) => {
        try {
          const { transaction } = data;
          
          // Validate and save transaction
          const savedTransaction = await this.saveTransaction(userId, transaction);
          
          // Broadcast to all user devices
          this.broadcastToUserDevices(userId, 'transaction_updated', {
            transaction: savedTransaction,
            timestamp: new Date().toISOString()
          });

          socket.emit('transaction_saved', {
            success: true,
            transaction: savedTransaction
          });
        } catch (error) {
          console.error('Transaction update error:', error);
          socket.emit('transaction_saved', {
            success: false,
            error: 'Failed to save transaction'
          });
        }
      });

      // Handle account updates
      socket.on('account_update', async (data) => {
        try {
          const { account } = data;
          
          const savedAccount = await this.saveAccount(userId, account);
          
          this.broadcastToUserDevices(userId, 'account_updated', {
            account: savedAccount,
            timestamp: new Date().toISOString()
          });

          socket.emit('account_saved', {
            success: true,
            account: savedAccount
          });
        } catch (error) {
          console.error('Account update error:', error);
          socket.emit('account_saved', {
            success: false,
            error: 'Failed to save account'
          });
        }
      });

      // Handle goal updates
      socket.on('goal_update', async (data) => {
        try {
          const { goal } = data;
          
          const savedGoal = await this.saveGoal(userId, goal);
          
          this.broadcastToUserDevices(userId, 'goal_updated', {
            goal: savedGoal,
            timestamp: new Date().toISOString()
          });

          socket.emit('goal_saved', {
            success: true,
            goal: savedGoal
          });
        } catch (error) {
          console.error('Goal update error:', error);
          socket.emit('goal_saved', {
            success: false,
            error: 'Failed to save goal'
          });
        }
      });

      // Handle booking notifications
      socket.on('booking_request', async (data) => {
        try {
          const { bookingId, message } = data;
          
          // Get booking details
          const booking = await prisma.bookingRequest.findUnique({
            where: { id: bookingId },
            include: {
              client: { select: { name: true, email: true } }
            }
          });

          if (!booking) {
            socket.emit('booking_notification', {
              success: false,
              error: 'Booking not found'
            });
            return;
          }

          // Send notification to advisor
          this.io.to(`user:${booking.advisorId}`).emit('booking_notification', {
            type: 'new_booking',
            booking: {
              id: booking.id,
              clientName: booking.client.name,
              clientEmail: booking.client.email,
              sessionType: booking.sessionType,
              proposedDate: booking.proposedDate,
              amount: booking.amount,
              message: message
            },
            timestamp: new Date().toISOString()
          });

          socket.emit('booking_notification', {
            success: true,
            message: 'Booking request sent'
          });
        } catch (error) {
          console.error('Booking request error:', error);
          socket.emit('booking_notification', {
            success: false,
            error: 'Failed to send booking request'
          });
        }
      });

      // Handle booking status updates
      socket.on('booking_status_update', async (data) => {
        try {
          const { bookingId, status, rejectionReason } = data;
          
          const updatedBooking = await prisma.bookingRequest.update({
            where: { id: bookingId },
            data: { status, rejectionReason },
            include: {
              client: { select: { name: true } },
              advisor: { select: { name: true } }
            }
          });

          // Notify client about status change
          this.io.to(`user:${updatedBooking.clientId}`).emit('booking_status_changed', {
            booking: {
              id: updatedBooking.id,
              status: updatedBooking.status,
              rejectionReason: updatedBooking.rejectionReason,
              advisorName: updatedBooking.advisor.name
            },
            timestamp: new Date().toISOString()
          });

          socket.emit('booking_status_updated', {
            success: true,
            booking: updatedBooking
          });
        } catch (error) {
          console.error('Booking status update error:', error);
          socket.emit('booking_status_updated', {
            success: false,
            error: 'Failed to update booking status'
          });
        }
      });

      // Handle payment notifications
      socket.on('payment_status_update', async (data) => {
        try {
          const { paymentId, status } = data;
          
          const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
              client: { select: { name: true } },
              advisor: { select: { name: true } }
            }
          });

          if (!payment) {
            socket.emit('payment_notification', {
              success: false,
              error: 'Payment not found'
            });
            return;
          }

          // Notify client about payment status
          this.io.to(`user:${payment.clientId}`).emit('payment_status_changed', {
            payment: {
              id: payment.id,
              status: status,
              amount: payment.amount,
              advisorName: payment.advisor.name
            },
            timestamp: new Date().toISOString()
          });

          // Notify advisor about payment
          this.io.to(`user:${payment.advisorId}`).emit('payment_received', {
            payment: {
              id: payment.id,
              status: status,
              amount: payment.amount,
              clientName: payment.client.name
            },
            timestamp: new Date().toISOString()
          });

          socket.emit('payment_status_updated', {
            success: true,
            payment
          });
        } catch (error) {
          console.error('Payment status update error:', error);
          socket.emit('payment_status_updated', {
            success: false,
            error: 'Failed to update payment status'
          });
        }
      });

      // Handle chat messages
      socket.on('chat_message', async (data) => {
        try {
          const { sessionId, message } = data;
          
          const chatMessage = await prisma.chatMessage.create({
            data: {
              sessionId,
              senderId: userId,
              message
            },
            include: {
              session: {
                include: {
                  client: { select: { name: true } },
                  advisor: { select: { name: true } }
                }
              }
            }
          });

          // Send message to session participants
          const session = chatMessage.session;
          this.io.to(`user:${session.clientId}`).emit('new_message', {
            message: chatMessage,
            timestamp: new Date().toISOString()
          });
          
          this.io.to(`user:${session.advisorId}`).emit('new_message', {
            message: chatMessage,
            timestamp: new Date().toISOString()
          });

          socket.emit('message_sent', {
            success: true,
            message: chatMessage
          });
        } catch (error) {
          console.error('Chat message error:', error);
          socket.emit('message_sent', {
            success: false,
            error: 'Failed to send message'
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(userId, socket.id, deviceId);
      });

      // Handle error
      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    });
  }

  private async getSyncData(userId: string, lastSyncedAt?: string, entityTypes?: string[]) {
    const whereClause = lastSyncedAt 
      ? {
          userId,
          updatedAt: {
            gt: new Date(lastSyncedAt),
          },
        }
      : { userId };

    const data: any = {};

    if (!entityTypes || entityTypes.includes('accounts')) {
      data.accounts = await prisma.account.findMany({
        where: whereClause,
      });
    }

    if (!entityTypes || entityTypes.includes('transactions')) {
      data.transactions = await prisma.transaction.findMany({
        where: whereClause,
      });
    }

    if (!entityTypes || entityTypes.includes('goals')) {
      data.goals = await prisma.goal.findMany({
        where: whereClause,
      });
    }

    if (!entityTypes || entityTypes.includes('loans')) {
      data.loans = await prisma.loan.findMany({
        where: whereClause,
      });
    }

    if (!entityTypes || entityTypes.includes('settings')) {
      data.settings = await prisma.userSettings.findUnique({
        where: { userId },
      });
    }

    return data;
  }

  private async saveTransaction(userId: string, transaction: any) {
    if (transaction.id) {
      // Update existing
      return await prisma.transaction.update({
        where: { id: transaction.id, userId },
        data: { ...transaction, updatedAt: new Date() }
      });
    } else {
      // Create new
      return await prisma.transaction.create({
        data: { ...transaction, userId, createdAt: new Date(), updatedAt: new Date() }
      });
    }
  }

  private async saveAccount(userId: string, account: any) {
    if (account.id) {
      return await prisma.account.update({
        where: { id: account.id, userId },
        data: { ...account, updatedAt: new Date() }
      });
    } else {
      return await prisma.account.create({
        data: { ...account, userId, createdAt: new Date(), updatedAt: new Date() }
      });
    }
  }

  private async saveGoal(userId: string, goal: any) {
    if (goal.id) {
      return await prisma.goal.update({
        where: { id: goal.id, userId },
        data: { ...goal, updatedAt: new Date() }
      });
    } else {
      return await prisma.goal.create({
        data: { ...goal, userId, createdAt: new Date(), updatedAt: new Date() }
      });
    }
  }

  private broadcastToUserDevices(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  private handleDisconnect(userId: string, socketId: string, deviceId: string) {
    // Remove from connected users
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
        this.userDevices.delete(userId);
      }
    }

    console.log(`Socket disconnected: User ${userId}, Device ${deviceId}, Socket ${socketId}`);
  }

  // Public methods for external use
  public notifyUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  public notifyDevice(deviceId: string, event: string, data: any) {
    this.io.to(`device:${deviceId}`).emit(event, data);
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public getUserConnections(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0;
  }
}

// Export singleton
let socketManager: SocketManager | null = null;

export function initializeSocket(httpServer: any) {
  if (!socketManager) {
    socketManager = new SocketManager(httpServer);
  }
  return socketManager;
}

export function getSocketManager(): SocketManager {
  if (!socketManager) {
    throw new Error('Socket manager not initialized');
  }
  return socketManager;
}