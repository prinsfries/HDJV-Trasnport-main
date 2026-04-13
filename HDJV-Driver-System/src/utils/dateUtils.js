let dateFormat = '1'
let timeFormat = '12'

// Initialize from user preferences on module load
const initializeFromPreferences = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const preferences = user.preferences || {}
    dateFormat = preferences.dateFormat || '1'
    timeFormat = preferences.timeFormat || '12'
  } catch (error) {
    console.error('Failed to load date/time preferences:', error)
  }
}

// Initialize on import
initializeFromPreferences()

export const setDateFormat = (format) => {
  dateFormat = format
}

export const setTimeFormat = (format) => {
  timeFormat = format
}

export const refreshFromPreferences = () => {
  initializeFromPreferences()
}

export const formatLocalDate = (date) => {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const toUtcStartOfLocalDate = (dateString) => {
  if (!dateString) return ''
  const local = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(local.getTime())) return ''
  return local.toISOString()
}

export const toUtcEndOfLocalDate = (dateString) => {
  if (!dateString) return ''
  const local = new Date(`${dateString}T23:59:59.999`)
  if (Number.isNaN(local.getTime())) return ''
  return local.toISOString()
}

export const formatDate = (dateString) => {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '--'
  return formatCustomDate(date, dateFormat)
}

export const formatTime = (dateString) => {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '--'
  return formatCustomTime(date, timeFormat)
}

export const formatDateTime = (dateString) => {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '--'
  return `${formatCustomDate(date, dateFormat)} at ${formatCustomTime(date, timeFormat)}`
}

const formatCustomDate = (date, format) => {
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December']
  const monthAbbrev = monthNames.map(m => m.substring(0, 3))

  switch(format) {
    case '1': // MM/DD/YY
      return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`
    case '2': // DD/MM/YY
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
    case '3': // YY/MM/DD
      return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
    case '4': // Month D, Yr
      return `${monthNames[month-1]} ${day}, ${year}`
    case '5': // M/D/YY
      return `${month}/${day}/${year}`
    case '6': // D/M/YY
      return `${day}/${month}/${year}`
    case '7': // YY/M/D
      return `${year}/${month}/${day}`
    case '8': // D Month, Yr
      return `${day} ${monthNames[month-1]}, ${year}`
    case '9': // Yr, Month D
      return `${year}, ${monthNames[month-1]} ${day}`
    case '10': // Mon-DD-YYYY
      return `${monthAbbrev[month-1]} ${String(day).padStart(2, '0')}, ${year}`
    case '11': // DD-Mon-YYYY
      return `${String(day).padStart(2, '0')} ${monthAbbrev[month-1]}, ${year}`
    case '12': // YYYY-Mon-DD
      return `${year}, ${monthAbbrev[month-1]} ${String(day).padStart(2, '0')}`
    case '13': // Mon DD, YYYY
      return `${monthAbbrev[month-1]} ${String(day).padStart(2, '0')}, ${year}`
    case '14': // DD Mon, YYYY
      return `${String(day).padStart(2, '0')} ${monthAbbrev[month-1]}, ${year}`
    case '15': // YYYY, Mon DD
      return `${year}, ${monthAbbrev[month-1]} ${String(day).padStart(2, '0')}`
    default:
      return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`
  }
}

const formatCustomTime = (date, format) => {
  let hours = date.getHours()
  let minutes = date.getMinutes()
  let ampm = ''

  if (format === '12') {
    ampm = hours >= 12 ? ' PM' : ' AM'
    hours = hours % 12
    hours = hours ? hours : 12 // 0 should be 12
  }

  const pad = (num) => String(num).padStart(2, '0')

  switch(format) {
    case '12':
      return `${hours}:${pad(minutes)}${ampm}`
    case '24':
      return `${pad(hours)}:${pad(minutes)}`
    default:
      return `${hours}:${pad(minutes)}${ampm}`
  }
}
