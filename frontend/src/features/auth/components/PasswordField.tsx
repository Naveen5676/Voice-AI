import { useState } from 'react'
import { IconButton, InputAdornment, TextField } from '@mui/material'
import type { TextFieldProps } from '@mui/material'

export function PasswordField(props: TextFieldProps) {
  const [visible, setVisible] = useState(false)
  return <TextField {...props} type={visible ? 'text' : 'password'} slotProps={{
    input: {
      endAdornment: <InputAdornment position="end">
        <IconButton size="small" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)} edge="end" sx={{ fontSize: 12, borderRadius: 1, px: 1 }}>
          {visible ? 'Hide' : 'Show'}
        </IconButton>
      </InputAdornment>,
    },
  }} />
}
