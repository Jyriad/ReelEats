# CSS Cleanup Plan

## Analysis of 166 !important declarations

### Categories:

1. **Light Mode Enforcement (KEEP - necessary for theme override)**
   - `background-color: #f3f4f6 !important;` - Force light bg
   - `color: #111827 !important;` - Force dark text  
   - `color-scheme: light only !important;` - Browser theme
   - Count: ~15 (keep these)

2. **Scrollbar Styling (KEEP - browser compatibility)**
   - `background-color: #f1f5f9 !important;` - Scrollbar bg
   - `scrollbar-width: none !important;` - Hide scrollbar
   - Count: ~10 (keep these)

3. **Structural/Layout Critical (KEEP - required for layout)**
   - `height: calc(100vh - 60px) !important;` - Main layout
   - `overflow: hidden !important;` - Drawer container
   - `display: none !important;` - Hidden elements
   - `z-index: 20 !important;` - Layering
   - Count: ~30 (keep these)

4. **Tailwind Conflicts (REMOVE - fix specificity instead)**
   - `background-color`, `color` in buttons
   - `box-shadow`, `transform` in hover states
   - Count: ~80 (can be removed)

5. **Mobile Drawer (KEEP - necessary for smooth dragging)**
   - Transform and transition overrides
   - Count: ~20 (keep these)

6. **Marker Highlighting (PARTIAL - can reduce)**
   - Scale transforms on markers
   - Count: ~10 (can optimize)

## Action Plan

### Phase 1: Keep Essential (65 declarations)
- Light mode enforcement ✓
- Scrollbar styling ✓
- Critical layout ✓
- Mobile drawer ✓

### Phase 2: Replace with Higher Specificity (80 declarations)
Most Tailwind conflicts can be resolved by:
1. Using more specific selectors
2. Using `:not()` pseudo-classes
3. Using Tailwind's `important` variant instead: `!bg-blue-500`

Example replacements:
```css
/* Before */
.button { background-color: red !important; }

/* After - more specific */
.modal .button { background-color: red; }
.modal .button:not(.default) { background-color: red; }
```

### Phase 3: Remove Unnecessary (21 declarations)
- Marker transforms (can use classes)
- Redundant hover states
- Duplicate color overrides

## Target Result
- From 166 → ~65 !important declarations
- 61% reduction
- All critical functionality preserved
- Better maintainability

