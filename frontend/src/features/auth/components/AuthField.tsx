import { TextField } from '@mui/material'
import type { TextFieldProps } from '@mui/material'
import { useController } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import type { AuthFormValues } from 'backend/validator/auth'
import { PasswordField } from './PasswordField'

type Props = Omit<TextFieldProps, 'name' | 'value' | 'onChange' | 'error'> & {
  name: keyof AuthFormValues
  control: Control<AuthFormValues>
}

export function AuthField({ name, control, helperText, ...props }: Props) {
  const { field: { ref, ...field }, fieldState: { error } } = useController({ name, control })
  const Component = name === 'password' ? PasswordField : TextField
  return <Component {...props} {...field} inputRef={ref} error={!!error} helperText={error?.message || helperText} />
}
