# Openclaw Dashboard

## Design Context

### Users
Technical users - developers and power users who value detailed information, keyboard shortcuts, and efficient workflows. They expect professional-grade tools that don't get in their way.

### Brand Personality
**Minimal. Fast. Reliable.**
- No unnecessary decorations or chrome
- Responsive interactions, streaming responses
- Consistent behavior, stable interface
- Chinese language interface (中文界面)

### Aesthetic Direction
**Modern & Innovative** with a focus on:
- Dark mode primary (light mode optional)
- Clean, functional layouts inspired by ChatGPT/Claude.ai
- Sky blue accent (#0ea5e9 / primary-500/600)
- Neutral grays for depth (neutral-900 → neutral-700)
- Subtle borders and minimal shadows
- Clear visual hierarchy with typography

### Design Principles

1. **Clarity over cleverness** - Every element serves a purpose. If it doesn't communicate or enable action, remove it.

2. **Speed is a feature** - Optimistic UI updates, streaming responses, no loading spinners unless necessary. The interface should feel instantaneous.

3. **Dark mode first** - Design for dark backgrounds. Ensure text contrast meets WCAG AA. Use neutral-900 as base, neutral-800 for cards, neutral-700 for borders.

4. **Type hierarchy matters** - Headings should stand out clearly. Body text should be readable. Code blocks should be visually distinct.

5. **Consistent interaction patterns** - Hover states, focus rings, and transitions should be uniform. Use primary-600 for interactive elements, primary-700 for hover states.

### Color Palette
- **Background**: neutral-900 (#171717)
- **Card/Surface**: neutral-800 (#262626)
- **Border**: neutral-700 (#404040)
- **Text Primary**: white (#ffffff)
- **Text Secondary**: neutral-400 (#a3a3a3)
- **Primary/Accent**: sky-500 (#0ea5e9) / sky-600 (#0284c7)
- **Success**: green-500 (#22c55e)
- **Warning**: amber-500 (#f59e0b)
- **Error**: red-500 (#ef4444)

### Typography
- **Font Stack**: System fonts (Inter-like rendering)
- **Headings**: font-semibold or font-bold
- **Body**: font-normal, leading-relaxed
- **Code**: font-mono, text-sm

### Spacing Scale
Use Tailwind's default spacing. Key patterns:
- Section padding: p-4 or p-6
- Component gaps: gap-2 or gap-3
- Card padding: p-3 or p-4

### Component Patterns
- **Buttons**: rounded-lg, py-2 px-4, transition-colors
- **Cards**: rounded-lg, bg-neutral-800, border border-neutral-700
- **Inputs**: rounded-lg, bg-neutral-800, border border-neutral-700, focus:ring-primary-500
- **Icons**: lucide-react, w-4 h-4 for inline, w-5 h-5 for standalone

### Animation & Transitions
- Prefer transition-colors for hover states
- Use transition-all sparingly
- Streaming cursor animation: blinking '▊' character
- Avoid jarring animations; prefer smooth, subtle movements
