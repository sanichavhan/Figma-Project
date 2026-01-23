A Figma-inspired design editor built completely with HTML, CSS & Vanilla JavaScript, focused on real-world canvas interactions like drag, resize, layers, styling, and export.
This project was built to understand how professional design tools actually work under the hood.

Why This Project is Interesting

1. Most tutorials stop at “draw a rectangle on canvas”.
2. This project goes much further 
3. Real object-based canvas system (not just drawings)
4. State management for undo, redo, selection & layers
5. Live property binding between canvas objects and sidebar controls
6. Export designs to PNG, PDF, JSON & HTML
7. Persistent designs using localStorage

Key Features
Shape & Object System

1. Rectangle, Circle, Triangle, Text & Image tools
2. Objects created dynamically via tool selection
3. Default size handling with live width/height editing
4. Transparent / filled shapes with stroke control

Professional Canvas Interactions

Click to select objects
1. Drag to move
2. Resize using corner handles (Figma-style
3. Multi-selection with Shift
4. Keyboard delete support

Right Panel – Live Properties

1. Fill color & stroke color binding
2. Font family, size & style for text
3. Width & height controls synced with selected object
4. Sidebar auto-updates when selection changes

Layers Panel

1. Every object appears as a layer
2. Click layer → selects object on canvas
3. Active layer highlighting

Undo / Redo

1. Ctrl + Z undo support
2. Internal state stack (up to last 30 actions)

Export Options
1. PNG – direct canvas export
2. PDF – using jsPDF
3. JSON – reusable design data
4. HTML – generates clean HTML preview of the design

Theme System
1. Multiple pre-defined themes
2. CSS variables based dynamic theme switching

Tech Stack

1. HTML Canvas API
2. JavaScript 
3. CSS Variables for Theming
4. LocalStorage for Persistence
5. html2canvas & jsPDF for Export

No liZraries for drawing or state management – everything is custom built.

What I Learned From This Project

1. How design tools manage objects instead of pixels
2. Mouse math & coordinate systems in canvas
3. Handling resize handles & hit-testing
4. Syncing UI panels with canvas state
5. Building scalable, maintainable frontend logic without frameworks
