import fs from 'node:fs'
import path from 'node:path'
import archiver from 'archiver'

const EXPORTS_BASE = path.join(process.cwd(), 'exports', 'player-analysis')

export function ensureExportDir(exportId: string): string {
  const dir = path.join(EXPORTS_BASE, exportId)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function writeExportFile(exportId: string, filename: string, content: string): { sizeBytes: number } {
  const dir = path.join(EXPORTS_BASE, exportId)
  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, content, 'utf8')
  return { sizeBytes: Buffer.byteLength(content, 'utf8') }
}

export function writeExportJsonFile(exportId: string, filename: string, data: unknown): { sizeBytes: number } {
  return writeExportFile(exportId, filename, JSON.stringify(data, null, 2))
}

export function getExportFilePath(exportId: string, filename: string): string {
  return path.join(EXPORTS_BASE, exportId, filename)
}

export function exportFileExists(exportId: string, filename: string): boolean {
  return fs.existsSync(path.join(EXPORTS_BASE, exportId, filename))
}

export async function createBundleZip(exportId: string, filenames: string[]): Promise<{ sizeBytes: number }> {
  const dir = path.join(EXPORTS_BASE, exportId)
  const zipPath = path.join(dir, 'bundle.zip')

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    output.on('close', () => resolve({ sizeBytes: archive.pointer() }))
    archive.on('error', reject)

    archive.pipe(output)

    for (const filename of filenames) {
      if (filename === 'bundle.zip') continue
      const filePath = path.join(dir, filename)
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: filename })
      }
    }

    archive.finalize()
  })
}

export function validateAndResolveExportFilePath(exportId: string, filename: string): string | null {
  // exportId must be UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(exportId)) {
    return null
  }
  // filename must not contain traversal sequences
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return null
  }
  const resolved = path.join(EXPORTS_BASE, exportId, filename)
  if (!resolved.startsWith(EXPORTS_BASE + path.sep)) {
    return null
  }
  return resolved
}

export function getExportFileSize(exportId: string, filename: string): number {
  try {
    return fs.statSync(path.join(EXPORTS_BASE, exportId, filename)).size
  } catch {
    return 0
  }
}

export function countCsvRows(exportId: string, filename: string): number {
  try {
    const content = fs.readFileSync(path.join(EXPORTS_BASE, exportId, filename), 'utf8')
    const lines = content.split('\n').filter((line) => line.trim().length > 0)
    return Math.max(0, lines.length - 1) // subtract header row
  } catch {
    return 0
  }
}
