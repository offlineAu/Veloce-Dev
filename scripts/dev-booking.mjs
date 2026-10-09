import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync } from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const calRoot = fileURLToPath(new URL('../../cal.com/', import.meta.url));
const logs = `${root}.dev-db/booking-logs`;
if (!existsSync(`${root}.env.development.local`) || !existsSync(`${calRoot}apps/api/v2/dist/apps/api/v2/src/main.js`)) {
  throw new Error('Local Cal configuration/build missing. See docs/LOCAL_MEETING_TESTING.md.');
}
mkdirSync(logs, { recursive: true });
const listening = port => new Promise(resolve => {
  const socket = net.connect({ host: '127.0.0.1', port });
  socket.setTimeout(1000);
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
  socket.once('timeout', () => { socket.destroy(); resolve(false); });
});
for (const port of [5432, 54329]) {
  if (!await listening(port)) throw new Error(`PostgreSQL on ${port} must be running before local booking starts.`);
}
const children = [];
const services = [
  ['redis', 6379, 'redis-server', ['--bind', '127.0.0.1', '--save', '', '--appendonly', 'no'], root],
  ['mail', 1025, 'npm', ['exec', '--yes', '--package=maildev@2.2.1', '--', 'maildev', '--smtp', '1025', '--web', '8025', '--ip', '127.0.0.1', '--web-ip', '127.0.0.1'], root],
  ['cal-api', 5555, process.execPath, ['dist/apps/api/v2/src/main.js'], `${calRoot}apps/api/v2`],
  ['cal-web', 3002, process.execPath, [`${calRoot}node_modules/next/dist/bin/next`, 'dev', '--turbopack', '-p', '3002'], `${calRoot}apps/web`],
  ['veloce', 3000, 'npm', ['run', 'dev'], root],
];
function stop() {
  for (const child of children) { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
}
process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });
try {
  for (const [name, port, command, args, cwd] of services) {
    if (await listening(port)) { console.log(`${name}: already running on ${port}`); continue; }
    const fd = openSync(`${logs}/${name}.log`, 'a', 0o600);
    const child = spawn(command, args, { cwd, detached: true, stdio: ['ignore', fd, fd] });
    closeSync(fd);
    children.push(child);
    let failed = false;
    child.once('error', () => { failed = true; });
    child.once('exit', () => { failed = true; });
    let ready = false;
    for (let attempt = 0; attempt < 60 && !failed; attempt++) {
      if (await listening(port)) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error(`${name} did not start. Inspect ${logs}/${name}.log.`);
    console.log(`${name}: ready on ${port}`);
  }
  console.log('Veloce: http://localhost:3000\nCal: http://localhost:3002\nLocal email inbox: http://localhost:8025');
  if (children.length) console.log('Keep this terminal open. Ctrl+C stops only the services started by this command.');
} catch (error) { stop(); throw error; }
