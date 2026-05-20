# Handoff Report: Milestone 3-2 (Frontend Config UI)

## 1. Observation
- The frontend config UI is implemented in `d:\personal\living_graph_tc\frontend\src\App.tsx`.
- **Max Depth & Filter**: A control panel exists with a filter input (`filterText`) and a number input (`maxDepth`) (lines 247-273).
- **Debounce**: Implemented via a `setTimeout` of 300ms in a `useEffect` (lines 132-134), which sets a `debounce_id` before fetching.
- **Loading Overlay**: Implemented at lines 316-337. It renders a semi-transparent div when `loading` is true. However, this div has `pointerEvents: 'none'` (line 325).
- **Dropdown Auto-complete**: Implemented using an `<input list="alias-list">` (line 250) bound to a `<datalist id="alias-list">` populated from `/api/aliases`. This provides autocomplete suggestions but allows the user to type and submit arbitrary strings not in the list.

## 2. Logic Chain
- `SCOPE.md` specifies: "While the API is fetching, an overlay should block the canvas to prevent race conditions." The CSS property `pointerEvents: 'none'` on the overlay makes it invisible to mouse clicks, allowing interactions with the canvas underneath, failing the blocking requirement.
- `SCOPE.md` specifies: "the user should be forced to select from the standardized terms". An HTML `<datalist>` gives auto-complete but does not strictly enforce selection (a user can type any string). To meet the "forced" requirement, validation or a strict `<select>` input is required.

## 3. Caveats
- The backend API was not investigated; this analysis assumes `/api/aliases` returns a proper string array.
- "Forced to select" could just colloquially mean providing suggestions in some contexts, but strict enforcement requires a code change.

## 4. Conclusion
Milestone 3-2 is largely implemented but requires a fix strategy to fully satisfy `SCOPE.md` requirements:
1. **Fix Loading Overlay**: Change `pointerEvents: 'none'` to `'auto'` (or remove it) in `App.tsx` (line 325) so it blocks user interactions during loading.
2. **Enforce Dropdown Selection**: Replace the text input + `<datalist>` with a proper `<select>` element (or add validation logic on blur/submit to clear invalid inputs) to strictly force standardized terms.

## 5. Verification Method
- **Overlay**: Run the app, trigger a graph fetch, and attempt to click on nodes while the "Loading..." overlay is visible. With the fix, clicks should be intercepted.
- **Dropdown**: Try typing a random unlisted string into the filter input. With the fix, this should either be impossible or rejected.
