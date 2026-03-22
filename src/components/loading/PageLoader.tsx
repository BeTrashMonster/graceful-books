import { useEffect, useState } from 'react'
import './PageLoader.css'

interface PageLoaderProps {
  message?: string
}

export function PageLoader({ message = 'Loading your workspace...' }: PageLoaderProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Only show loader after a brief delay to avoid flashing for fast loads
    const timer = setTimeout(() => setShow(true), 100)
    return () => clearTimeout(timer)
  }, [])

  if (!show) {
    return null
  }

  return (
    <div className="page-loader" role="status" aria-live="polite" aria-label={message}>
      <div className="page-loader__card">
        <div className="page-loader__icon">
          <img src="/assets/sparkle-1.png" alt="" className="sparkle" />
          <img src="/assets/hourglass.png" alt="" className="treasure" />
          <img src="/assets/sparkle-2.png" alt="" className="sparkle sparkle--right" />
        </div>
        <h2 className="page-loader__title">Gathering Your Data</h2>
        <p className="page-loader__message">{message}</p>
        <div className="page-loader__bar">
          <div className="page-loader__progress"></div>
        </div>
        <p className="page-loader__tip">
          💜 Take a deep breath - you're building something great!
        </p>
      </div>
    </div>
  )
}
