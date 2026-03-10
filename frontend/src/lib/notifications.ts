import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { toast } from 'sonner';
import { db, type Notification } from './database';
import supabase from '@/utils/supabase/client';

type NotificationInput = Omit<Notification, 'id' | 'createdAt' | 'isRead'> & {
  createdAt?: Date;
  isRead?: boolean;
};

type SupabaseNotificationRow = {
  id: number;
  user_id: string;
  type: Notification['type'];
  title: string;
  message: string;
  due_date: string | null;
  is_read: boolean;
  related_id: number | null;
  created_at: string;
};

const SYNCABLE_NOTIFICATION_TYPES = new Set<Notification['type']>(['emi', 'loan', 'goal', 'group']);

let initialized = false;
let initializedUserId: string | null = null;
let supabaseNotificationChannel: ReturnType<typeof supabase.channel> | null = null;
let periodicNotificationCheck: ReturnType<typeof setInterval> | null = null;

const toLocalNotification = (remote: SupabaseNotificationRow): Notification => ({
  type: remote.type,
  title: remote.title,
  message: remote.message,
  dueDate: remote.due_date ? new Date(remote.due_date) : undefined,
  isRead: remote.is_read,
  relatedId: remote.related_id ?? undefined,
  createdAt: new Date(remote.created_at),
  userId: remote.user_id,
  remoteId: String(remote.id),
  source: 'supabase',
});

const shouldUseSystemNotification = () =>
  typeof document !== 'undefined' && document.visibilityState !== 'visible';

async function getActiveUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

async function showSystemNotification(title: string, body: string) {
  if (Capacitor.isNativePlatform()) {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display === 'granted') {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Number(`${Date.now()}`.slice(-8)),
            title,
            body,
            schedule: { at: new Date(Date.now() + 250) },
          },
        ],
      });
    }
    return;
  }

  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
    }
  }
}

async function showDeliveredNotification(notification: Notification) {
  toast.info(notification.title, {
    description: notification.message,
  });

  if (shouldUseSystemNotification()) {
    await showSystemNotification(notification.title, notification.message);
  }
}

async function upsertLocalNotification(notification: Notification) {
  if (notification.remoteId) {
    const existingRemote = await db.notifications
      .filter((item) => item.remoteId === notification.remoteId)
      .first();

    if (existingRemote?.id) {
      await db.notifications.put({ ...notification, id: existingRemote.id });
      return existingRemote.id;
    }
  }

  const existingMatch = await db.notifications
    .filter((item) =>
      item.title === notification.title
      && item.message === notification.message
      && item.relatedId === notification.relatedId
      && Math.abs(new Date(item.createdAt).getTime() - new Date(notification.createdAt).getTime()) < 1000,
    )
    .first();

  if (existingMatch?.id) {
    await db.notifications.put({ ...notification, id: existingMatch.id });
    return existingMatch.id;
  }

  return db.notifications.add(notification);
}

async function syncRemoteNotification(row: SupabaseNotificationRow, notifyUser = false) {
  const localNotification = toLocalNotification(row);
  const existing = row.id
    ? await db.notifications.filter((item) => item.remoteId === String(row.id)).first()
    : undefined;

  await upsertLocalNotification(localNotification);

  if (notifyUser && !existing && !localNotification.isRead) {
    await showDeliveredNotification(localNotification);
  }
}

async function syncSupabaseNotifications() {
  const userId = await getActiveUserId();
  if (!userId) return;

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) {
    if (error) {
      console.info('ℹ️ Supabase notifications sync skipped:', error.message);
    }
    return;
  }

  for (const row of data as SupabaseNotificationRow[]) {
    await syncRemoteNotification(row, false);
  }
}

async function subscribeToSupabaseNotifications() {
  const userId = await getActiveUserId();
  if (!userId || typeof (supabase as any).channel !== 'function') return;

  if (supabaseNotificationChannel) {
    await (supabase as any).removeChannel?.(supabaseNotificationChannel);
  }

  supabaseNotificationChannel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          const previous = payload.old as SupabaseNotificationRow;
          await db.notifications.where('remoteId').equals(String(previous.id)).delete();
          return;
        }

        const next = payload.new as SupabaseNotificationRow;
        await syncRemoteNotification(next, payload.eventType === 'INSERT');
      },
    )
    .subscribe();
}

async function createRemoteNotification(notification: Notification) {
  if (!notification.userId || !SYNCABLE_NOTIFICATION_TYPES.has(notification.type)) {
    return;
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      due_date: notification.dueDate?.toISOString() ?? null,
      is_read: notification.isRead,
      related_id: notification.relatedId ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    if (error) {
      console.info('ℹ️ Supabase notification insert skipped:', error.message);
    }
    return;
  }

  await syncRemoteNotification(data as SupabaseNotificationRow, false);
}

export const showNotification = (
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
): void => {
  const show = type === 'error' ? toast.error : type === 'success' ? toast.success : type === 'warning' ? toast.warning : toast.info;
  show(message);
};

export const createNotificationRecord = async (input: NotificationInput) => {
  const userId = input.userId ?? await getActiveUserId();
  const notification: Notification = {
    ...input,
    userId,
    createdAt: input.createdAt ?? new Date(),
    isRead: input.isRead ?? false,
    source: input.source ?? 'local',
  };

  const id = await upsertLocalNotification(notification);

  if (!notification.isRead) {
    await showDeliveredNotification(notification);
  }

  await createRemoteNotification(notification);
  return id;
};

export const markNotificationAsRead = async (id: number) => {
  const notification = await db.notifications.get(id);
  if (!notification) return;

  await db.notifications.update(id, {
    isRead: true,
    readAt: new Date(),
  });

  if (notification.remoteId) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', Number(notification.remoteId));
  }
};

export const markAllNotificationsAsRead = async () => {
  const notifications = await db.notifications.toArray();
  await Promise.all(
    notifications.map((notification) => notification.id ? markNotificationAsRead(notification.id) : Promise.resolve()),
  );
};

export const deleteNotificationRecord = async (id: number) => {
  const notification = await db.notifications.get(id);
  if (!notification) return;

  await db.notifications.delete(id);

  if (notification.remoteId) {
    await supabase
      .from('notifications')
      .delete()
      .eq('id', Number(notification.remoteId));
  }
};

export const clearNotificationRecords = async () => {
  const notifications = await db.notifications.toArray();
  await db.notifications.clear();

  const remoteIds = notifications
    .map((notification) => notification.remoteId)
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (remoteIds.length > 0) {
    await supabase
      .from('notifications')
      .delete()
      .in('id', remoteIds);
  }
};

export const checkAndCreateNotifications = async () => {
  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const userId = await getActiveUserId();

  const loans = await db.loans.filter((loan) => loan.status === 'active' && !!loan.dueDate).toArray();
  for (const loan of loans) {
    if (!loan.dueDate) continue;

    const dueDate = new Date(loan.dueDate);
    if (dueDate >= today && dueDate <= in7Days) {
      const existing = await db.notifications
        .filter((item) => item.type === 'loan' && item.relatedId === loan.id)
        .first();

      if (!existing) {
        await createNotificationRecord({
          type: 'loan',
          title: 'Upcoming Loan Payment',
          message: `${loan.name} payment of ${loan.emiAmount || loan.outstandingBalance} is due on ${dueDate.toLocaleDateString()}`,
          dueDate,
          relatedId: loan.id,
          userId,
        });
      }
    }
  }

  const goals = await db.goals.filter((goal) => goal.currentAmount < goal.targetAmount).toArray();
  for (const goal of goals) {
    const targetDate = new Date(goal.targetDate);
    const daysRemaining = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 30 && daysRemaining > 0) {
      const existing = await db.notifications
        .filter((item) => item.type === 'goal' && item.relatedId === goal.id)
        .first();

      if (!existing) {
        const remaining = goal.targetAmount - goal.currentAmount;
        const monthlyRequired = remaining / Math.max(1, daysRemaining / 30);

        await createNotificationRecord({
          type: 'goal',
          title: 'Goal Deadline Approaching',
          message: `${goal.name} is ${daysRemaining} days away. Save ${monthlyRequired.toFixed(2)} per month to stay on track.`,
          dueDate: targetDate,
          relatedId: goal.id,
          userId,
        });
      }
    }
  }
};

export const initializeNotifications = async () => {
  const userId = await getActiveUserId();

  if (initialized && initializedUserId === userId) {
    await syncSupabaseNotifications();
    return;
  }

  if (initialized) {
    if (supabaseNotificationChannel) {
      await (supabase as any).removeChannel?.(supabaseNotificationChannel);
      supabaseNotificationChannel = null;
    }
  }

  initialized = true;
  initializedUserId = userId ?? null;
  await checkAndCreateNotifications();
  await syncSupabaseNotifications();
  await subscribeToSupabaseNotifications();

  if (periodicNotificationCheck) {
    clearInterval(periodicNotificationCheck);
  }

  periodicNotificationCheck = setInterval(() => {
    void checkAndCreateNotifications();
    void syncSupabaseNotifications();
  }, 60 * 60 * 1000);
};
