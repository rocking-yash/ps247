import { ViewTransition } from 'react';

// A template remounts when the top-level route changes, so moving between
// /, /simulator and /dashboard crossfades the old page into the new one
// (timing in globals.css). Moving around inside the dashboard does not.
export default function Template({ children }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}
