import { mkdir, copyFile } from 'node:fs/promises'

const destination = new URL('../public/licenses/', import.meta.url)
await mkdir(destination, { recursive: true })
for (const packageName of [
  '@fontsource/space-grotesk',
  '@fontsource/ibm-plex-sans',
  '@fontsource/ibm-plex-mono',
  'react',
  'react-dom',
  'react-icons',
]) {
  await copyFile(
    new URL(`../node_modules/${packageName}/LICENSE`, import.meta.url),
    new URL(`${packageName.replace('@fontsource/', '')}.txt`, destination),
  )
}
