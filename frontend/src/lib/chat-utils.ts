export interface GroupedChats {
  today: any[];
  last7Days: any[];
  last30Days: any[];
  older: any[];
}

export const groupChatsByDate = (chats: any[]): GroupedChats => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last7Days = new Date(today);
  last7Days.setDate(last7Days.getDate() - 7);
  const last30Days = new Date(today);
  last30Days.setDate(last30Days.getDate() - 30);

  return chats.reduce(
    (groups: GroupedChats, chat) => {
      const chatDate = new Date(chat.created_at);

      if (chatDate >= today) {
        groups.today.push(chat);
      } else if (chatDate >= last7Days) {
        groups.last7Days.push(chat);
      } else if (chatDate >= last30Days) {
        groups.last30Days.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    { today: [], last7Days: [], last30Days: [], older: [] }
  );
};
