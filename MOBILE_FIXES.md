# Mobile Display Fixes

## Issue: Sidebar Content Hidden on Mobile

**Problem**: On mobile devices, when opening the left sidebar (hamburger menu), only the header was visible. The actual navigation content was pushed down and hidden due to the header expanding to fill half the screen.

**Root Cause**: Docusaurus's default CSS sets `flex-grow: 1` on `.navbar-sidebar__brand` (the header section), causing it to expand from ~60px to ~311px when the sidebar becomes a flex container.

## Solution

**File**: `src/css/custom.css` (Mobile Responsive Fixes section)

**Fix Applied**:
```css
@media (max-width: 996px) {
  /* Sidebar container: full viewport height with flex column */
  .navbar-sidebar {
    height: 100vh !important;
    display: flex !important;
    flex-direction: column !important;
  }

  /* Brand/Header: Prevent flex growth - this is the key fix */
  .navbar-sidebar__brand {
    flex: 0 0 auto !important;
  }

  /* Items/Content: Fill remaining space */
  .navbar-sidebar__items {
    flex: 1 1 auto !important;
    min-height: 0;
  }
}
```

**Key Changes**:
1. `flex: 0 0 auto` on brand prevents it from growing beyond its content height
2. `height: 100vh` ensures sidebar covers full viewport
3. `flex: 1 1 auto` on items allows content area to fill remaining space

## Before vs After

| Metric | Before | After |
|--------|--------|-------|
| Brand height | ~311px | ~60px |
| Items height | ~327px | ~579px |
| Visible content | Header only | Full navigation |

## Testing

1. Open site on mobile device or use browser's responsive mode (≤996px width)
2. Click hamburger menu icon
3. Verify sidebar shows full navigation content immediately
4. Test "← Back to main menu" panel switching
5. Verify scrolling works for long menu lists

## Related: Table Horizontal Scroll

Wide tables on mobile now scroll horizontally instead of being truncated. See the table CSS in the same file for details.
