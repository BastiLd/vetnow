/* Hilfsprogramm für proc.test.js — stellt einen Prozessbaum nach, wie ihn
   `npm install && npx expo start` erzeugt:

       node _port-halter.js <port>      (Elternteil, wartet nur)
         └─ node -e "…"                 (Kind, hält den Port)

   Entscheidend ist, dass NICHT der gestartete Prozess selbst den Port hält,
   sondern erst dessen Kind — genau daran ist der alte Stopp-Weg gescheitert. */
const { spawn } = require('child_process');

const port = parseInt(process.argv[2], 10);
const kind = spawn(
  process.execPath,
  ['-e', `require('http').createServer((q, s) => s.end('ok')).listen(${port}, '0.0.0.0'); setInterval(() => {}, 1 << 30);`],
  { stdio: 'inherit' },
);
kind.on('exit', () => process.exit(0));
setInterval(() => {}, 1 << 30);
