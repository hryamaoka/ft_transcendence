// Helpers for the end-to-end checks: real HTTP and Socket.IO against the running app.
import { io } from 'socket.io-client';

export const BASE = process.env.BASE || 'https://localhost:8443';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function http(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(cookie && { cookie }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, type: res.headers.get('content-type'), data: await res.json().catch(() => null), res };
}

// A fresh account, logged in. Names are random so runs never collide.
// `cookie` is the session; `device` marks this "browser" as one that has logged in before.
export async function signup(tag) {
  const name = `${tag}_${Math.random().toString(36).slice(2, 9)}`.slice(0, 20);
  const email = `${name}@example.com`;
  const { res, data } = await http('/api/auth/register', { method: 'POST', body: { email, password: 'password123', name } });
  if (!res.ok || data.error) throw new Error(`signup failed: ${JSON.stringify(data)}`);
  const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]);
  return {
    name, email, id: data.id,
    cookie: cookies.find((c) => c.startsWith('token=')),
    device: cookies.find((c) => c.startsWith('device=')),
  };
}

// A connected socket that remembers the latest room:state and room:me and every chat message.
export function connect(user) {
  const socket = io(BASE, { extraHeaders: { cookie: user.cookie }, rejectUnauthorized: false, transports: ['websocket'], reconnection: false });
  const seat = { socket, user, state: null, me: null, chat: [], invites: [], kicked: false, frames: 0 };
  socket.on('room:state', (s) => { seat.state = s; seat.frames++; });
  socket.on('room:me', (m) => { seat.me = m; });
  socket.on('chat:message', (m) => seat.chat.push(m));
  socket.on('chat:history', (h) => { seat.chat = [...h]; });
  socket.on('chat:clear', () => { seat.chat = []; });
  socket.on('room:invite', (i) => seat.invites.push(i));
  socket.on('room:kicked', () => { seat.kicked = true; });
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(seat));
    socket.on('connect_error', reject);
  });
}

export const call = (seat, event, payload = {}) => new Promise((resolve) => seat.socket.emit(event, payload, resolve));

export async function newRoom(user) {
  const { data } = await http('/api/rooms', { method: 'POST', body: { lang: 'en' }, cookie: user.cookie });
  return data.code;
}

export async function join(seat, code) {
  const res = await call(seat, 'room:join', { code });
  if (res.ok) {
    seat.state = res.state;
    seat.me = res.me;
    seat.chat = res.chat;
  }
  return res;
}

// Waits until check() is truthy, polling; throws with `what` after `ms`.
export async function until(check, what, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = check();
    if (value) return value;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${what}`);
}

export async function serverAlive() {
  try {
    return (await fetch(`${BASE}/api/config`)).ok;
  } catch {
    return false;
  }
}
