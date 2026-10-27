# Dynamic Grid Plugin

Embeddable grid / carousel for Google Sites, driven by a Google Sheet. Plain HTML, CSS and ES modules; no build step and no dependencies.

## Set up

1. In Google Sheets: The sheet must be shared so anyone with the link can view: `Anyone with the link → Viewer`
1. Copy the Google Sheets link
1. Open the [builder page](https://21beckem.github.io/dynamic-grid-plugin/google-sheets/builder/)
1. In Google Sites: **Insert → Embed → By URL**, paste the link, then resize the embed on the page.

The sheet must be shared as **Anyone with the link → Viewer** (or published to the web). Everything runs in the visitor's browser, so the sheet's contents are public.

## URL options

Only `uid` is required. Option names are case-insensitive.

| Option | Default | Notes |
|---|---|---|
| `uid` | — | Sheet ID (or the whole sheet URL). Published-to-web IDs (`2PACX-…`) work too. |
| `sheet` | first tab | Tab name or gid. Digit-only tab names must be given by gid. Published sheets accept gid only. |
| `title`, `description`, `image`, `link` | auto | A column name, plain text, or a `{{Column}}` template such as `{{First}} {{Last}}`. When omitted, common header names are tried (title/name, description/summary/about, image/photo, link/url/site); title falls back to the first column. |
| `view` | `grid` | `grid` or `carousel` |
| `columns` | auto | Exact number of columns (visible cards in a carousel). Drops to 2, then 1 on narrow embeds. Wins over `minWidth`. |
| `minWidth` | `220` | Minimum card width in px, used when `columns` is empty |
| `aspect` | `4:3` | `16:9`, `3:2`, `4:3`, `1:1`, `3:4` |
| `gap` | `16` | Space between cards in px |
| `limit` | all | Show only the first N rows |
| `background` | `transparent` | `transparent`, `light`, `dark` |
| `accent` | `2f5d8a` | Hex color, without `#` |
| `autoplay` | `0` | Carousel only: seconds between slides, 0 = off |

## Behavior worth knowing

- **Sizing:** Google Sites sets the embed's height. The layout fills the embed's width and reflows when it changes; a grid taller than the embed scrolls inside it.
- **Links** always open in a new tab (links can't navigate inside a Sites embed).
- **Link cells** must contain the address itself. A cell with a hyperlink on other text only gives the visible text to the embed.
- **Images:** Google Drive share links are converted automatically. Broken or missing images show a placeholder.
- **Errors:** a bad or missing option, an unreachable sheet, or an unknown column shows a message in the embed with a link to the builder, which opens pre-filled with the same settings.
- Sheet data is cached in the visitor's session for 60 seconds.

## Extending / Contributing

| To add… | Do this |
|---|---|
| An option | Add one entry to `OPTIONS` in `js/options.js`, then use `values.<key>` in `js/embed.js` (or a view via `ctx`). The builder form, validation, defaults and URL output update on their own. |
| A view | Add `js/views/<name>.js` exporting `{ name, render(container, items, ctx) }`, register it in `js/views/index.js`, and add any CSS. It appears in the builder's View menu automatically. |
| An option type | Add a parser to `PARSERS` in `js/options.js` and a control factory to `controls` in `js/builder.js`. |
| A data source | Add a module like `js/sheets.js` returning `{ headers, rows }` and call it from `js/embed.js`. |