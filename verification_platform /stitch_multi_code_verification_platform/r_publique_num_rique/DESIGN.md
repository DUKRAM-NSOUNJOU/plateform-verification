---
name: République Numérique
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf1'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fa'
  on-surface: '#111c2c'
  on-surface-variant: '#444653'
  inverse-surface: '#263142'
  inverse-on-surface: '#ebf1ff'
  outline: '#757684'
  outline-variant: '#c5c5d5'
  surface-tint: '#3e54c1'
  primary: '#001360'
  on-primary: '#ffffff'
  primary-container: '#002395'
  on-primary-container: '#8094ff'
  inverse-primary: '#bac3ff'
  secondary: '#bb0021'
  on-secondary: '#ffffff'
  secondary-container: '#e32033'
  on-secondary-container: '#fffbff'
  tertiary: '#1c1f21'
  on-tertiary: '#ffffff'
  tertiary-container: '#313437'
  on-tertiary-container: '#999c9f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dee1ff'
  primary-fixed-dim: '#bac3ff'
  on-primary-fixed: '#001159'
  on-primary-fixed-variant: '#223aa8'
  secondary-fixed: '#ffdad7'
  secondary-fixed-dim: '#ffb3af'
  on-secondary-fixed: '#410005'
  on-secondary-fixed-variant: '#930018'
  tertiary-fixed: '#e0e3e6'
  tertiary-fixed-dim: '#c4c7ca'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#44474a'
  background: '#f9f9ff'
  on-background: '#111c2c'
  surface-variant: '#d8e3fa'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  container-max: 1200px
---

## Brand & Style
The design system is built upon a "French Corporate" aesthetic: a synthesis of institutional authority and modern digital efficiency. It targets high-stakes verification environments where trust is the primary currency. The personality is disciplined, sophisticated, and transparent.

The visual direction leans into **Minimalism** with **Modern Corporate** sensibilities. It prioritizes clarity and "breathing room" to reduce the cognitive load associated with security tasks. By utilizing a restrained palette and precise geometric alignments, the UI evokes the feeling of a secure, state-backed FinTech portal or an official government gateway. High-quality whitespace is used as a functional tool to isolate critical verification data.

## Colors
This design system employs a "Tricolore" inspired palette, refined for digital accessibility and professional restraint.

*   **Primary (Navy Blue):** Used for primary actions, headers, and institutional branding. It represents stability and security.
*   **Secondary (French Red):** Used sparingly as a high-intent accent or for critical alerts. It provides the signature French flair without compromising the professional atmosphere.
*   **Neutral Palette:** A range of soft grays and crisp whites create the "canvas." Backgrounds should primarily use the subtle blue-gray (`#F8FAFC`) to reduce eye strain compared to pure white.
*   **Status Logic:**
    *   **Success:** A deep, forest green to indicate verified states.
    *   **Error/Critical:** The secondary French Red, signifying immediate attention required.
    *   **Pending:** The primary Navy Blue, suggesting a process is in motion but secure.

## Typography
Inter is selected for its exceptional legibility in data-heavy and technical interfaces. The typographic hierarchy is strictly enforced to guide the user through verification flows.

Headlines should use tighter letter-spacing to appear more authoritative and "locked-in." Labels use a medium weight to ensure they remain legible even at small scales against colored backgrounds. For technical strings or verification codes, consider a tracking increase of 5% to improve character recognition.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for desktop to maintain a sense of order and structure, transitioning to a fluid model for mobile devices.

*   **Grid:** A 12-column grid is standard for desktop. Verification forms should ideally be centered and span no more than 6 columns to maintain focus.
*   **Spacing Rhythm:** All spacing is derived from a 4px base unit. Component internal padding should favor "generous" values (e.g., 16px or 24px) to emphasize the premium feel.
*   **Breakpoints:**
    *   **Mobile:** Under 600px. Single column, 16px side margins.
    *   **Tablet:** 600px - 1024px. 8-column grid, 24px margins.
    *   **Desktop:** 1024px+. 12-column grid with a max-width container of 1200px.

## Elevation & Depth
Elevation is handled through **Tonal Layers** supplemented by **Ambient Shadows**. This creates a physical sense of "objects on a desk," which reinforces the metaphor of official paperwork and verification.

*   **Surfaces:** The primary background is the lowest layer. Cards and containers use pure white (`#FFFFFF`) to pop against the subtle gray background.
*   **Shadows:** Use a "Security Shadow" style—very low opacity (4-8%) with a large blur radius (20px+) and a slight Y-offset (4px). This creates a soft, natural lift rather than a harsh drop-shadow.
*   **Borders:** Use 1px borders in a very light gray (`#E2E8F0`) even on shadowed elements to define edges clearly in high-glare environments.

## Shapes
A consistent "Rounded" profile is applied to avoid the clinical harshness of sharp corners while maintaining professional structure. 

*   **Standard Elements:** Buttons, inputs, and small cards use a 0.5rem (8px) radius.
*   **Large Containers:** Main verification modules or modals use a 1rem (16px) radius to feel more approachable and modern.
*   **Icons:** Should be housed in rounded-square containers or circles to maintain the "stamp of approval" look.

## Components
Consistent component behavior is vital for maintaining the "Official" feel of this design system.

*   **Buttons:** Primary buttons use the Navy Blue background with white text. They should have a subtle 1px top-inner highlight to feel slightly tactile.
*   **Input Fields:** Use a thick 2px border on focus in Navy Blue. Verification code inputs should be oversized (Type: Display) with generous character spacing.
*   **Cards:** Pure white background, 8px radius, and the "Security Shadow." Cards used for "Verified Records" should include a 4px left-border accent in the Primary Navy or Status Green.
*   **Status Chips:** Small, pill-shaped indicators with a low-opacity background of the status color and a high-contrast text version of the same color (e.g., Light Green bg with Dark Green text).
*   **Progress Indicators:** Steppers should be linear and minimalist, using the Primary Navy for completed steps and a light gray for upcoming ones.