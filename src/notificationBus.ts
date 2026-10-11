export type NotificationPayload = {
  user_id?: number | null;
  user_name?: string | null;
  department_id?: number | null;
  target_role?: string | null;
  title: string;
  message: string;
  type?: string;
  created_at?: string;
};

type NotificationClient = {
  id: string;
  userId?: number | null;
  role?: string | null;
  departmentId?: number | null;
  res: {
    write: (chunk: string) => boolean;
    end: () => void;
  };
};

const notificationClients = new Set<NotificationClient>();

export const registerNotificationClient = (client: NotificationClient) => {
  notificationClients.add(client);
};

export const unregisterNotificationClient = (client: NotificationClient) => {
  notificationClients.delete(client);
};

const shouldNotifyClient = (payload: NotificationPayload, client: NotificationClient) => {
  if (payload.user_id && Number(payload.user_id) === Number(client.userId)) return true;
  if (payload.department_id && Number(payload.department_id) === Number(client.departmentId)) return true;
  if (payload.target_role && payload.target_role === client.role) return true;
  if (!payload.user_id && !payload.department_id && !payload.target_role) return true;
  return false;
};

export const broadcastNotification = (payload: NotificationPayload) => {
  const event = `event: notification\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of Array.from(notificationClients)) {
    if (shouldNotifyClient(payload, client)) {
      try {
        client.res.write(event);
      } catch {
        // Client stream may have closed; ignore and clean up in the next tick.
      }
    }
  }
};
