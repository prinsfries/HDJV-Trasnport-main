import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export const useLazyTable = ({
  items,
  pageSize = 50,
  resetKey = '',
  hasMoreRemote = false,
  onFetchMore,
  threshold = 0.9,
}) => {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(pageSize, items.length))
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const containerRef = useRef(null)

  const lastResetKeyRef = useRef(resetKey)

  useEffect(() => {
    const resetKeyChanged = lastResetKeyRef.current !== resetKey
    if (resetKeyChanged) {
      lastResetKeyRef.current = resetKey
      const nextCount = Math.min(pageSize, items.length)
      setVisibleCount(nextCount)
      return
    }

    // When items arrive for the first time, ensure we show the first page.
    if (visibleCount === 0 && items.length > 0) {
      const nextCount = Math.min(pageSize, items.length)
      setVisibleCount(nextCount)
    }

    // If the dataset grew after a reset, ensure we still show at least one page.
    if (items.length > 0 && visibleCount < Math.min(pageSize, items.length)) {
      const nextCount = Math.min(pageSize, items.length)
      setVisibleCount(nextCount)
    }
  }, [resetKey, pageSize, items.length, visibleCount])

  useEffect(() => {
    if (visibleCount > items.length) {
      setVisibleCount(items.length)
    }
  }, [visibleCount, items.length])

  const hasMore = visibleCount < items.length || hasMoreRemote

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return

    if (visibleCount < items.length) {
      setVisibleCount((prev) => clamp(prev + pageSize, 0, items.length))
      return
    }

    if (onFetchMore) {
      setIsLoadingMore(true)
      try {
        const addedCount = await onFetchMore()
        if (addedCount > 0) {
          setVisibleCount((prev) => prev + Math.min(pageSize, addedCount))
        }
      } finally {
        setIsLoadingMore(false)
      }
    }
  }, [isLoadingMore, hasMore, visibleCount, items.length, pageSize, onFetchMore])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el || isLoadingMore || !hasMore) return
    const scrollPercentage = (el.scrollTop + el.clientHeight) / el.scrollHeight
    if (scrollPercentage > threshold) {
      loadMore()
    }
  }, [hasMore, isLoadingMore, loadMore, threshold])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const safeCount = Math.min(visibleCount, items.length)
  const visibleItems = useMemo(() => items.slice(0, safeCount), [items, safeCount])

  return {
    containerRef,
    visibleItems,
    visibleCount: safeCount,
    hasMore,
    isLoadingMore,
    loadMore,
  }
}
