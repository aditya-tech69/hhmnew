# Design System Specification: The Ethereal Atelier

## 1. Overview & Creative North Star
**Creative North Star: "The Refracted Lens"**

This design system moves away from the rigid, boxed structures of traditional e-commerce. Instead, it treats the interface as a curated gallery where high-end crockery and glassware are showcased through layers of light and transparency. By merging **Glassmorphism** with **Minimalist Luxury**, we simulate a physical environment of reflection and refraction. 

We break the "template" look through:
*   **Intentional Asymmetry:** Hero layouts should favor off-center compositions, allowing products to breathe and overlap with glass containers.
*   **Tonal Depth:** We abandon traditional lines in favor of "stacking" planes of varying translucency.
*   **High-Contrast Scale:** Utilizing extreme shifts between `display-lg` (Noto Serif) and `label-sm` (Manrope) to create an editorial, magazine-like hierarchy.

---

## 2. Colors & Surface Philosophy

The palette is a sophisticated dialogue between champagne neutrals, charcoal shadows, and the "absence" of color represented by glass.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Structural boundaries must be defined solely through:
1.  **Background Shifts:** Transitioning from `surface` to `surface-container-low`.
2.  **Tonal Step-ups:** Placing a `surface-container-lowest` card on a `surface-container` background.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of frosted crystal.
*   **Base:** `surface` (#faf9f7)
*   **Depth 1 (Sunken):** `surface-container-low` (#f4f3f1) for secondary content wells.
*   **Depth 2 (Elevated):** `surface-container-lowest` (#ffffff) for primary product cards.
*   **Depth 3 (Floating):** Semi-transparent `surface-bright` with `backdrop-filter: blur(20px)` for navigation and modals.

### The "Glass & Gradient" Rule
To ensure main CTAs don't feel flat, use a subtle radial gradient transitioning from `primary` (#5f5e5e) to `primary-container` (#dddbda) at a 45-degree angle. This simulates the way light catches the edge of a polished ceramic plate.

---

## 3. Typography

The typographic system pairs the classic authority of **Noto Serif** with the precision of **Manrope**.

*   **Editorial Expression (Noto Serif):** Used for `display` and `headline` tiers. It should feel like a title in a high-fashion journal. High tracking (letter-spacing: -0.02em) on large headlines adds a modern edge.
*   **Functional Precision (Manrope):** Used for `title`, `body`, and `labels`. This sans-serif provides the "Innovation" in HHM Innovation—clean, legible, and tech-forward.
*   **Hierarchy Note:** Use `display-lg` for product names in hero sections, but immediately drop to `label-md` for technical specifications to create a signature "High-Low" visual contrast.

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved through **Tonal Layering**. Avoid shadows for static elements. For example, a product filter menu should not have a shadow; it should be a `surface-container-high` panel sliding over a `surface` background.

### Ambient Shadows
When a component must "float" (e.g., a floating shopping cart or a lightboxed product view), use:
*   **Blur:** 40px to 60px.
*   **Opacity:** 4% - 6% of `on-surface` (#1a1c1b).
*   **Spread:** -5px (to keep the shadow tight and sophisticated, not muddy).

### The "Ghost Border" Fallback
If accessibility requires a container boundary, use a **Ghost Border**: `outline-variant` (#cdc5bb) at **15% opacity**. Never use 100% opaque lines.

### Glassmorphism Specs
For floating headers or detail panes:
*   **Fill:** `surface-container-lowest` at 70% opacity.
*   **Backdrop Blur:** 12px to 20px.
*   **Highlight:** A 1px top-edge "specular highlight" using `primary-fixed` (#e5e2e1) at 30% opacity to simulate the rim of a glass.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary` (#5f5e5e) with `on-primary` (#ffffff) text. Use `rounded-sm` (0.125rem) for a sharp, architectural feel.
*   **Secondary (The Glass Button):** `surface-container-lowest` at 40% opacity + backdrop blur. No border.
*   **Tertiary:** Text-only in `secondary` (#765a26) with a 1px underline that expands on hover.

### Cards & Product Grids
*   **Constraint:** Forbid divider lines. Use `spacing-8` (2.75rem) to separate items.
*   **Interaction:** On hover, a card should shift from `surface` to `surface-container-lowest` and scale by 1.02, simulating a physical object being brought closer to the eye.

### Input Fields
*   **Style:** Minimalist underline using `outline-variant` (#cdc5bb) at 40% opacity. 
*   **Focus State:** The underline transitions to `secondary` (#765a26) and a subtle "glow" (ambient shadow) appears behind the input area.

### Signature Component: "The Specimen Modal"
A full-screen glass overlay (`surface` at 80% opacity + heavy blur) where the product image is rendered with a `primary-fixed-dim` ambient shadow to make the glassware feel 3D and "touchable."

---

## 6. Do's and Don'ts

### Do:
*   **Use Asymmetric White Space:** Use `spacing-20` and `spacing-24` to create "dead zones" that force the eye toward the product photography.
*   **Embrace Translucency:** Allow high-quality product images to bleed under glassmorphic navigation bars.
*   **Prioritize Materiality:** Use the `secondary` champagne tones (#765a26) only for "moments of delight" like price tags or special collections.

### Don't:
*   **Don't use 100% Black:** Always use `on-surface` (#1a1c1b) or `primary` (#5f5e5e) for text to maintain the soft, luxury feel.
*   **Don't use Rounded Corners > 4px:** High-end crockery is about precision. Keep `roundedness` to `sm` or `none` for most structural elements.
*   **Don't Over-Animate:** Transitions should be `cubic-bezier(0.2, 0, 0, 1)`—fast start, long smooth deceleration. Avoid "bouncy" or "elastic" effects.