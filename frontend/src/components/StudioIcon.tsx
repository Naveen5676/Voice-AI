import SvgIcon from '@mui/material/SvgIcon'
import type { SvgIconProps } from '@mui/material/SvgIcon'

const paths = {
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  back: 'M19 12H5m6-6-6 6 6 6',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3ZM5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-3 0h6',
  spark: 'm12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z',
  support: 'M4 13v-1a8 8 0 0 1 16 0v1M4 12H3v7h4v-7H4Zm16 0h1v7h-4v-7h3Zm0 7c0 2-3 3-6 3',
  greeting: 'M5 20h14M7 17h10a3 3 0 0 0 3-3 8 8 0 0 0-16 0 3 3 0 0 0 3 3Zm5-14v3m-2-3h4',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm5-1 5 5',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  edit: 'm4 16 11-11 4 4L8 20H4v-4ZM13 7l4 4',
  logout: 'M9 5H4v14h5m5-12 5 5-5 5m-6-5h11',
} as const

export function StudioIcon({ name, ...props }: SvgIconProps & { name: keyof typeof paths }) {
  return <SvgIcon {...props} viewBox="0 0 24 24"><path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></SvgIcon>
}
