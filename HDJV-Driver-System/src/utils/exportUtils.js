export const createCsvFilename = (baseName, options = {}) => {
  const safeBase = (baseName || 'export').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase()
  const hasDate = /\d{4}-\d{2}-\d{2}/.test(safeBase)
  const includeDate = options.includeDate ?? !hasDate
  if (!includeDate) {
    return `${safeBase}.csv`
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value || '0000'
  const month = parts.find((part) => part.type === 'month')?.value || '01'
  const day = parts.find((part) => part.type === 'day')?.value || '01'
  const dateStamp = `${year}-${month}-${day}`
  return `${safeBase}-${dateStamp}.csv`
}

const stringifyCellValue = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (Array.isArray(value)) {
    return value.filter((item) => item !== null && item !== undefined).join('; ')
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

const escapeCsvValue = (value) => {
  const text = stringifyCellValue(value)
  if (text === '') return ''
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export const buildCsv = (rows, columns) => {
  const safeRows = Array.isArray(rows) ? rows : []
  const safeColumns = Array.isArray(columns) ? columns : []
  const header = safeColumns.map((column) => escapeCsvValue(column.label)).join(',')
  const lines = safeRows.map((row) =>
    safeColumns
      .map((column) => {
        if (typeof column.value === 'function') {
          return escapeCsvValue(column.value(row))
        }
        if (column.key) {
          return escapeCsvValue(row?.[column.key])
        }
        return ''
      })
      .join(',')
  )
  return [header, ...lines].join('\r\n')
}

export const downloadCsv = async (csv, filename) => {
  const suggested = filename && filename.endsWith('.csv') ? filename : `${filename || 'export'}.csv`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = suggested
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

export const exportRowsToCsv = async ({ rows, columns, filename }) => {
  const csv = buildCsv(rows, columns)
  await downloadCsv(csv, filename)
}
