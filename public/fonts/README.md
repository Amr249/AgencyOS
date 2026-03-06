# Arabic fonts for invoice PDF

The invoice PDF uses **Cairo** for correct Arabic rendering. You must add the font files here.

## Option 1 — Google Fonts (recommended)

1. Go to [Google Fonts – Cairo](https://fonts.google.com/specimen/Cairo).
2. Click **Download family**.
3. From the ZIP, copy into this folder:
   - `Cairo-Regular.ttf` (required)
   - `Cairo-Bold.ttf` (optional; for bold headings)

## Option 2 — Variable font only

If you only have the variable font (e.g. `Cairo[slnt,wght].ttf` from the [Google Fonts GitHub repo](https://github.com/google/fonts/tree/main/ofl/cairo)):

1. Download the file and rename it to `Cairo-Regular.ttf`.
2. Place it in this folder.

Bold text may render as regular weight without a separate bold file.

---

After adding at least `Cairo-Regular.ttf`, the invoice PDF will render Arabic correctly.
