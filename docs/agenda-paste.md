# Agenda Paste Form

Allows administrators to paste or upload a full agenda message in WhatsApp format and submit it for bulk creation of events and news. The profile page now shows a dedicated **Subir Información** button that opens the modal directly in a third tab alongside the traditional "Evento" and "Noticia" forms.

```
¡Buenas noches!
AGENDA MUNICIPAL

Jueves 28
🕑9.30 hs.
✅Entrega de reconocimientos a los cuatro primeros Presidentes del HCD en democracia.
📍HCD
```

The parser splits each day and extracts time, title and location lines. A `.txt` or `.docx` file can also be uploaded, its contents will populate the textarea before processing.
