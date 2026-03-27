import { useEffect, useState } from 'react'
import './PageLoader.css'

interface PageLoaderProps {
  message?: string
}

export function PageLoader({ message = "This is the 'calm before your confidence' moment" }: PageLoaderProps) {
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
      <div className="page-loader__content">
        <div className="page-loader__logo">
          <img src="/assets/audacious-logo.png" alt="Audacious Money" />
        </div>
        <div className="page-loader__spinner">
          <div className="page-loader__spinner-ring"></div>
          <div className="page-loader__spinner-ring"></div>
          <div className="page-loader__spinner-ring"></div>
        </div>
        <p className="page-loader__message">{message}</p>
      </div>
    </div>
  )
}
