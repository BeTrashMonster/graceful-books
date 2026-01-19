/**
 * Confetti Animation Utility
 *
 * Per CHECK-002: CONFETTI MOMENT when completing an item (subtle, tasteful)
 *
 * Creates a simple, lightweight confetti animation using canvas
 * with reduced motion support.
 *
 * Security Note: This file uses Math.random() intentionally for visual animations.
 * These random values are NOT used for security purposes - they create visual
 * variety in confetti particle physics (position, velocity, rotation).
 * Math.random() is appropriate here as cryptographic randomness is not required.
 */

interface ConfettiOptions {
  /**
   * Number of confetti particles
   */
  particleCount?: number
  /**
   * Duration of animation in milliseconds
   */
  duration?: number
  /**
   * Origin point (0-1 normalized coordinates)
   */
  origin?: { x: number; y: number }
  /**
   * Color palette for confetti
   */
  colors?: string[]
  /**
   * Whether to respect reduced motion preference
   */
  respectReducedMotion?: boolean
}

interface Particle {
  x: number
  y: number
  velocityX: number
  velocityY: number
  rotation: number
  rotationSpeed: number
  size: number
  color: string
  opacity: number
}

const DEFAULT_COLORS = [
  '#4f46e5', // Primary
  '#10b981', // Success
  '#f59e0b', // Warning
  '#3b82f6', // Info
  '#ec4899', // Pink
  '#8b5cf6', // Purple
]

/**
 * Trigger confetti animation
 *
 * @example
 * ```ts
 * // Default confetti from center
 * triggerConfetti()
 *
 * // Custom confetti from button click
 * triggerConfetti({
 *   particleCount: 50,
 *   origin: { x: 0.5, y: 0.5 },
 *   duration: 2000
 * })
 * ```
 */
export function triggerConfetti(options: ConfettiOptions = {}): void {
  const {
    particleCount = 50,
    duration = 2000,
    origin = { x: 0.5, y: 0.5 },
    colors = DEFAULT_COLORS,
    respectReducedMotion = true,
  } = options

  // Check for reduced motion preference
  if (respectReducedMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '9999'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    document.body.removeChild(canvas)
    return
  }

  // Create particles
  const particles: Particle[] = []
  const originX = canvas.width * origin.x
  const originY = canvas.height * origin.y

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5
    const velocity = 3 + Math.random() * 4
    const size = 4 + Math.random() * 4

    particles.push({
      x: originX,
      y: originY,
      velocityX: Math.cos(angle) * velocity,
      velocityY: Math.sin(angle) * velocity - 2, // Slight upward bias
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      size,
      color: colors[Math.floor(Math.random() * colors.length)] || DEFAULT_COLORS[0]!,
      opacity: 1,
    })
  }

  // Animation
  const startTime = Date.now()
  const gravity = 0.15

  function animate() {
    if (!ctx) return

    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Update and draw particles
    let allOffscreen = true

    particles.forEach((particle) => {
      // Update physics
      particle.velocityY += gravity
      particle.x += particle.velocityX
      particle.y += particle.velocityY
      particle.rotation += particle.rotationSpeed
      particle.opacity = 1 - progress

      // Check if still visible
      if (
        particle.y < canvas.height + 50 &&
        particle.x > -50 &&
        particle.x < canvas.width + 50
      ) {
        allOffscreen = false
      }

      // Draw particle
      ctx.save()
      ctx.translate(particle.x, particle.y)
      ctx.rotate(particle.rotation)
      ctx.globalAlpha = particle.opacity

      // Draw rectangle confetti
      ctx.fillStyle = particle.color
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size)

      ctx.restore()
    })

    // Continue animation or cleanup
    if (progress < 1 && !allOffscreen) {
      requestAnimationFrame(animate)
    } else {
      document.body.removeChild(canvas)
    }
  }

  // Start animation
  requestAnimationFrame(animate)
}

/**
 * Trigger celebration confetti (more particles, longer duration)
 */
export function triggerCelebration(options: Partial<ConfettiOptions> = {}): void {
  triggerConfetti({
    particleCount: 100,
    duration: 3000,
    ...options,
  })
}

/**
 * Trigger subtle confetti (fewer particles, shorter duration)
 */
export function triggerSubtleConfetti(options: Partial<ConfettiOptions> = {}): void {
  triggerConfetti({
    particleCount: 30,
    duration: 1500,
    ...options,
  })
}
