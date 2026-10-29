// Online status: number of open sockets per user.
const sockets = new Map();

export const isOnline = (id) => (sockets.get(id) || 0) > 0;

export function trackPresence(io) {
  io.on('connection', (socket) => {
    const { id } = socket.data.user;
    sockets.set(id, (sockets.get(id) || 0) + 1);
    socket.on('disconnect', () => {
      const n = sockets.get(id) - 1;
      if (n > 0) sockets.set(id, n);
      else sockets.delete(id);
    });
  });
}
