import { useLayoutEffect, useRef } from 'react'

// Above this many tracked rows, measuring + transforming every node stops being a cheap
// cosmetic touch (e.g. during a large Excel import) — skip the animation rather than let
// it compete with the far more important work of getting the data on screen.
const MAX_ANIMATED_ITEMS = 500

/**
 * Classic FLIP (First-Last-Invert-Play) list reorder animation, no external library.
 * Call the returned `setRef(id)` as the ref callback on each list item; whenever the
 * order (orderKey) changes, items that moved slide smoothly from their old position
 * to their new one instead of jumping.
 */
export function useFlipList(orderKey) {
  const rectsRef = useRef(new Map())
  const nodesRef = useRef(new Map())

  const setRef = (id) => (node) => {
    if (node) nodesRef.current.set(id, node)
    else nodesRef.current.delete(id)
  }

  useLayoutEffect(() => {
    if (nodesRef.current.size > MAX_ANIMATED_ITEMS) {
      rectsRef.current = new Map()
      return
    }

    const newRects = new Map()
    nodesRef.current.forEach((node, id) => {
      newRects.set(id, node.getBoundingClientRect())
    })

    nodesRef.current.forEach((node, id) => {
      const oldRect = rectsRef.current.get(id)
      const newRect = newRects.get(id)
      if (!oldRect || !newRect) return

      const deltaY = oldRect.top - newRect.top
      if (Math.abs(deltaY) < 1) return

      node.style.transition = 'none'
      node.style.transform = `translateY(${deltaY}px)`
      node.getBoundingClientRect() // force reflow
      requestAnimationFrame(() => {
        node.style.transition = 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)'
        node.style.transform = ''
      })
    })

    rectsRef.current = newRects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey])

  return setRef
}
