import { HTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'
import styles from './Card.module.css'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Visual variant
   */
  variant?: 'default' | 'bordered' | 'elevated'
  /**
   * Padding size
   */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /**
   * Whether the card is hoverable
   */
  hoverable?: boolean
}

/**
 * Card component for grouping related content
 *
 * @example
 * ```tsx
 * <Card variant="elevated" padding="lg">
 *   <h3>Card Title</h3>
 *   <p>Card content goes here</p>
 * </Card>
 * ```
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      hoverable = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          styles.card,
          styles[variant],
          styles[`padding-${padding}`],
          hoverable && styles.hoverable,
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)

Card.displayName = 'Card'

/**
 * Card Header component
 */
export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div ref={ref} className={clsx(styles.header, className)} {...props}>
      {children}
    </div>
  )
})

CardHeader.displayName = 'CardHeader'

/**
 * Card Body component
 */
export const CardBody = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div ref={ref} className={clsx(styles.body, className)} {...props}>
      {children}
    </div>
  )
})

CardBody.displayName = 'CardBody'

/**
 * Card Footer component
 */
export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div ref={ref} className={clsx(styles.footer, className)} {...props}>
      {children}
    </div>
  )
})

CardFooter.displayName = 'CardFooter'
