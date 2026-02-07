import { Box, Typography } from '@mui/material';
// Vite raw import bundles the markdown content into the app.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import changelog from './CHANGELOG.md?raw';

export default function ChangelogView() {
  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
        Changelog
      </Typography>
      <Typography
        component="pre"
        sx={{
          m: 0,
          whiteSpace: 'pre-wrap',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        {String(changelog).trim()}
      </Typography>
    </Box>
  );
}
