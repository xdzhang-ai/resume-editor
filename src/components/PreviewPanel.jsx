import React, { useRef, useState, useLayoutEffect, useEffect, useCallback } from 'react'
import { useResume } from '../state/ResumeContext.jsx'
import ModuleView from './ModuleView.jsx'
import { paperPx, pageContentPx, PAPER_SIZES } from '../utils/paper.js'

const PAGE_GAP = 18 // visual gap between pages on screen

export default function PreviewPanel() {
  const { state } = useResume()
  const { meta, modules } = state

  const scrollRef = useRef(null)
  const measureRef = useRef(null)
  const sliceRefs = useRef([]) // 每个显示页切片 DOM，用于克隆测量层内容
  const [zoom, setZoom] = useState('fit') // number or 'fit'
  const [manualZoom, setManualZoom] = useState(0.72)

  const { w: pageW, h: pageH } = paperPx(meta.paperSize)
  const { w: contentW, h: contentH, margin } = pageContentPx(meta.paperSize)

  // Split the full flowing document into page windows [a, b). The measurement
  // layer is unscaled, so its block-top offsets match the displayed windows.
  const [pages, setPages] = useState([[0, contentH]])

  const recompute = useCallback(() => {
    const el = measureRef.current
    if (!el) return
    const docH = el.offsetHeight
    if (docH <= 0) return
    const docRect = el.getBoundingClientRect()
    const tops = new Set([0])
    // Fine-grained break candidates: module / entry / markdown paragraph /
    // list item. Fine granularity lets long blocks split between items instead
    // of being pushed whole to the next page.
    el.querySelectorAll(
      '.module, .entry, .md-render > *, .md-render li, .bullets li, .custom-item'
    ).forEach((b) => {
      const t = Math.round(b.getBoundingClientRect().top - docRect.top)
      if (t > 0) tops.add(t)
    })
    const sorted = [...tops].sort((x, y) => x - y)
    const eps = 0.5
    // If snapping to the last block top would waste more than this fraction of
    // a page (e.g. a tall block or a sparse gap), split at the page bottom
    // instead so the page stays filled and text simply continues across pages.
    const SPLIT_GAP = contentH * 0.35
    const result = []
    let a = 0
    while (a < docH - eps) {
      // Remaining content fits on this page -> take it all (no empty trailing page).
      if (docH - a <= contentH) {
        result.push([a, docH])
        break
      }
      let b = a
      for (const t of sorted) {
        if (t > a + eps && t <= a + contentH) b = t
        else if (t > a + contentH) break
      }
      if (b > a && a + contentH - b > SPLIT_GAP) {
        // Snapping would leave a big gap: fill the page by splitting here.
        b = a + contentH
      }
      if (b <= a) b = Math.min(a + contentH, docH)
      result.push([a, b])
      a = b
    }
    setPages(result.length ? result : [[0, Math.min(contentH, docH)]])
  }, [contentH])

  // Recompute on data / settings change.
  useLayoutEffect(() => {
    recompute()
  }, [recompute, modules, meta])

  // Recompute whenever layout shifts — font loading, late images, container
  // resize — so window positions never go stale (a common cause of content
  // appearing flush to the top or cut off after a page break).
  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    const ro = new ResizeObserver(() => recompute())
    ro.observe(el)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => recompute())
    }
    return () => ro.disconnect()
  }, [recompute])

  // 关键修复：显示层的每个页切片不再各自 re-render 整份文档，而是
  // 直接克隆「测量层」这一唯一数据源的 DOM。这样页面窗口 [a,b) 一定与
  // 实际显示内容完全对齐，杜绝因两层渲染不一致导致的内容被裁掉/掉进缝隙。
  useLayoutEffect(() => {
    const src = measureRef.current
    if (!src) return
    const html = src.innerHTML
    for (let i = 0; i < pages.length; i++) {
      const el = sliceRefs.current[i]
      if (el && el.innerHTML !== html) el.innerHTML = html
    }
  }, [pages, modules, meta, contentW])

  // 打印/导出前再算一次，确保字体与图片加载完毕后的最新布局被采用。
  useEffect(() => {
    const onPrint = () => recompute()
    window.addEventListener('beforeprint', onPrint)
    return () => window.removeEventListener('beforeprint', onPrint)
  }, [recompute])

  // Auto-fit zoom based on container width.
  const [fitZoom, setFitZoom] = useState(0.72)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const compute = () => {
      const avail = el.clientWidth - 48
      const z = Math.max(0.3, Math.min(1.2, avail / pageW))
      setFitZoom(z)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pageW])
  const effectiveZoom = zoom === 'fit' ? fitZoom : manualZoom

  const totalH = pages.length * pageH + (pages.length - 1) * PAGE_GAP

  // Keep the print @page size in sync with the chosen paper size.
  useEffect(() => {
    let tag = document.getElementById('print-page-style')
    if (!tag) {
      tag = document.createElement('style')
      tag.id = 'print-page-style'
      document.head.appendChild(tag)
    }
    const p = PAPER_SIZES[meta.paperSize] || PAPER_SIZES.A4
    tag.textContent = `@page { size: ${p.w}mm ${p.h}mm; margin: 0; }`
  }, [meta.paperSize])

  const cssVars = {
    '--theme-color': meta.themeColor,
    '--font-family': meta.fontFamily,
    '--base-font-size': `${meta.baseFontSize}px`,
    '--line-height': String(meta.lineHeight)
  }

  const docClass = `resume-doc tpl-${meta.templateId} ${meta.accentSoft ? '' : 'no-accent'}`

  // The whole resume as one flowing document. Reused for measurement and for
  // every page window (each page shows a different slice of the same content).
  const renderDoc = (prefix) =>
    modules.map((m) => (
      <div className="module" key={`${prefix}-${m.id}`}>
        <ModuleView module={m} />
      </div>
    ))

  return (
    <div className="preview">
      <div className="preview-toolbar">
        <span className="preview-toolbar-label">实时预览</span>
        <div className="zoom-controls">
          <button
            className={zoom === 'fit' ? 'zbtn active' : 'zbtn'}
            onClick={() => setZoom('fit')}
          >
            适应宽度
          </button>
          <input
            type="range"
            min="0.3"
            max="1.2"
            step="0.02"
            value={effectiveZoom}
            onChange={(e) => {
              setManualZoom(parseFloat(e.target.value))
              setZoom(parseFloat(e.target.value))
            }}
          />
          <span className="zoom-value">{Math.round(effectiveZoom * 100)}%</span>
        </div>
      </div>

      <div className="preview-scroll" ref={scrollRef}>
        <div
          className="preview-fit"
          style={{ width: pageW * effectiveZoom, height: totalH * effectiveZoom }}
        >
          {/* Hidden measurement layer: full document at content width. Kept
              OUTSIDE the scaled .resume-stage so getBoundingClientRect returns
              unscaled coordinates that match contentH / docH. */}
          <div className="resume-measure-wrap" style={{ width: contentW }}>
            <div className={docClass} style={cssVars} ref={measureRef}>
              {renderDoc('m')}
            </div>
          </div>

          <div
            className="resume-stage"
            style={{
              width: pageW,
              height: totalH,
              transform: `scale(${effectiveZoom})`,
              transformOrigin: 'top left'
            }}
          >
            {/* Display layer: one page per window, each clipped to [a, b).
               切片内容由 useLayoutEffect 克隆自测量层，保证与分页窗口完全对齐。 */}
            {pages.map(([a, b], i) => (
              <div
                className="resume-page"
                key={i}
                style={{ width: pageW, height: pageH }}
              >
                <div
                  className="resume-clip"
                  style={{
                    top: margin,
                    left: margin,
                    width: contentW,
                    height: b - a
                  }}
                >
                  <div
                    className={`resume-slice ${docClass}`}
                    ref={(el) => (sliceRefs.current[i] = el)}
                    style={{
                      width: contentW,
                      ...cssVars,
                      transform: `translateY(${-a}px)`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
