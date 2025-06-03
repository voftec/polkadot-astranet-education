# Design Style Reference

This document reverse engineers the visual design of the **Polkadot Astranet Education** web app so that key styling choices can be reused consistently.

## Brand Colors

- **Polkadot Pink** `#E6007A`
- **Polkadot Black** `#000000`
- **White** `#FFFFFF`
- **Light Gray** `#F5F5F5`
- **Medium Gray** `#CCCCCC`
- **Dark Gray** `#333333`

The primary accent color is Polkadot Pink, while Polkadot Black is used for secondary accents. Backgrounds default to white, with Light Gray used for subtle alternatives. Dark mode switches the background and text colors to maintain contrast.

## Typography

The interface uses the **Unbounded** typeface (with Arial as fallback). Base font size is `16px` and headings scale as follows:

- `h1` – `2.5rem`
- `h2` – `2rem`
- `h3` – `1.75rem`
- `h4` – `1.5rem`
- `h5` – `1.25rem`
- `h6` – `1rem`

Headings are bold (`font-weight:700`) and share a line height of 1.2. Body copy uses a line height of 1.6 for readability.

## Navigation Bar

The header is sticky and casts a subtle shadow:

```css
.header {
  background-color: var(--background);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}
```

Navigation links are horizontally aligned with a simple underline animation on hover and when active:

```css
.nav-list {
  display: flex;
  list-style: none;
}
.nav-item { margin-left: var(--spacing-lg); }
.nav-link { font-weight: 500; padding: var(--spacing-xs) 0; position: relative; }
.nav-link::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0;
  width: 0; height: 2px;
  background-color: var(--primary);
  transition: width var(--transition-medium);
}
.nav-link:hover::after,
.nav-link.active::after { width: 100%; }
```

The "Login" button inside the nav uses a bordered style that inverts on hover:

```css
.nav-login-btn {
  margin-left: var(--spacing-lg);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--primary);
  border-radius: var(--border-radius-sm);
  color: var(--primary);
  font-weight: 500;
}
.nav-login-btn:hover,
.nav-login-btn:focus-visible {
  background: var(--primary);
  color: var(--white);
}
```

## Layout and Spacing

Reusable CSS variables define spacing units (`--spacing-xs` to `--spacing-xxl`) and border radii. Containers center the content with a maximum width of `1200px`.

## Dark Mode

When the body has the `dark-mode` class, the palette flips to dark backgrounds and light text:

```css
.dark-mode {
  --background: var(--polkadot-black);
  --background-alt: var(--dark-gray);
  --text: var(--white);
  --text-light: var(--light-gray);
}
```

Users can toggle dark mode via the moon/sun icon in the navigation bar. The state persists through `localStorage`.

---

These values capture the core look and feel—bright Polkadot Pink accents, clean typography with generous spacing, and a responsive sticky nav. Use this document to maintain visual consistency across future pages or components.
