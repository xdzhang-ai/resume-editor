// Paper size + pagination helpers.
export const PAPER_SIZES = {
  A4: { w: 210, h: 297, label: 'A4 · 210×297mm' },
  A5: { w: 148, h: 210, label: 'A5 · 148×210mm' },
  Letter: { w: 215.9, h: 279.4, label: 'Letter · 8.5×11in' }
}

const MM_TO_PX = 96 / 25.4 // 1mm ≈ 3.7795px @96dpi

export function mmToPx(mm) {
  return mm * MM_TO_PX
}

// Returns page outer size in px at 96dpi (screen px, before zoom scaling).
export function paperPx(size) {
  const p = PAPER_SIZES[size] || PAPER_SIZES.A4
  return { w: mmToPx(p.w), h: mmToPx(p.h) }
}

// Page inner content box (subtract margins).
export const MARGIN_MM = 16
export function pageContentPx(size) {
  const { w, h } = paperPx(size)
  const m = mmToPx(MARGIN_MM)
  return { w: w - m * 2, h: h - m * 2, margin: m }
}
