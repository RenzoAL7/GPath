import { spawn, execFileSync } from 'node:child_process'
execFileSync(process.execPath, ['scripts/write-release.mjs'], { stdio: 'inherit' })
execFileSync(process.execPath, ['scripts/copy-licenses.mjs'], { stdio: 'inherit' })
const children = [
  spawn(process.execPath, ['--env-file-if-exists=.env.local', 'server/index.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, HOST: '127.0.0.1', PORT: '8081' },
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5173', '--strictPort'], {
    stdio: 'inherit',
  }),
]
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}
for (const child of children) {
  child.on('exit', (code) => stop(code || 0))
  child.on('error', () => stop(1))
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
