# Page Override

## Screen

- Name: Recent (the second tab, route `/recent`; `/history` is a preserved alias)
- User goal: find something produced earlier, confirm it is still on the device,
  and save, share, reopen, rename or delete it without doubt about scope

## Deviations from master

- Every row states filename, tool, timestamp, input size, output size and the
  actual space saved. When the store did not record an original size the row says
  the saving is unknown. It never shows a zero or an estimate in place of a fact.
- Availability is part of the row, not a failure discovered on tap. A record
  whose file is gone shows a distinct icon, a caution line, and disabled actions.
- A summary strip above the list carries the total count and total measured
  saving, and names how many records could not be measured.
- Row actions live in a sheet rather than a swipe. A swipe is invisible to
  keyboard and VoiceOver users and cannot carry six actions.
- Reopen only appears enabled for a PDF that is still present, because that is
  the only thing the viewer can accept.
- Clearing offers two actions where the platform supports them: clear the list,
  and delete the kept files only. Where the current adapter stores both together
  the second is disabled and says why, rather than being hidden.
- Every destructive action confirms, names the exact scope, and states that
  copies already saved elsewhere are untouched. Because every one of them does,
  the screen header does not say it a second time: the boundary belongs at the
  press that decides something, and three lines of it above the first row is
  three fewer rows of what the person came for.

## States

Loading is three skeleton rows in place. Error shows the message and a retry.
Empty explains what will appear here and offers the tools tab. Success from an
action appears as a polite status line above the list, not a toast over content.

## Constraints

- Reads and writes only through the typed ports in
  `hooks/useWorkspaceRuntime.tsx`. No direct persistence decisions here.
- Unknown values are rendered as unknown. Never inferred.
- Long filenames wrap; they are never truncated so that the extension is lost.
