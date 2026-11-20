# VisionViewer

> VisionViewer shows every moviegoer the view from their seat, in 3D, before they pay. It is a widget for cinema operators: each auditorium is modeled to its real dimensions, and the view plugs into the cinema's own website and mobile app, inside the booking flow.

Key facts:

- Who it is for: cinema groups and independent cinemas that sell tickets online with seat selection.
- Two integrations, one script tag and one call each: a 3D view opened from the cinema's existing seat map (`VisionViewer.open`), or VisionViewer's 2D seat map plus the 3D view inserted in the booking page (`VisionViewer.mountPlan`).
- The cinema keeps its ticketing system. VisionViewer stores the shape of the auditoriums only: no showtimes, no availability, no sales.
- Nothing is recorded about moviegoers: no account, no cookie, no local storage.
- Each auditorium is modeled from its real measurements: rows, slope, spacing, screen (flat or curved), wheelchair spaces, double seats. No seat map yet? VisionViewer builds it from photos or an on-site survey.
- Pricing is by quote.
- Company: VisionViewer SAS, France (being incorporated). Contact: contact@visionviewer.net
- The site is in French and in English; the integration guide and the legal pages are in French.

## Documentation

- [Integration guide](https://docs.visionviewer.net/): the SDK, with runnable examples (in French)
