import { Alert, Button, LinearProgress } from '@mui/material'

export function WorkspaceStatus({ error, retry }: { error: string | null; retry: () => void }) {
  return error ? <Alert severity="error" action={<Button color="inherit" onClick={retry}>Try again</Button>}>{error}</Alert>
    : <LinearProgress aria-label="Loading your agents" sx={{ mt: 4 }} />
}
