import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cx } from '../../lib/cx'
import styles from './Button.module.css'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger' | 'onDark'
type Size = 'sm' | 'md' | 'lg'

type StyleProps = { variant?: Variant; size?: Size; block?: boolean }

function buttonClass({ variant = 'secondary', size = 'md', block }: StyleProps, extra?: string) {
  return cx(styles.button, styles[variant], styles[size], block && styles.block, extra)
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  StyleProps & { loading?: boolean; icon?: ReactNode }

export function Button({ variant, size, block, loading, icon, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon}
      {children}
    </button>
  )
}

type ButtonLinkProps = LinkProps & StyleProps & { icon?: ReactNode; /** Opens another site in a new tab. */ external?: boolean }

export function ButtonLink({ variant, size, block, icon, className, children, external, to, ...rest }: ButtonLinkProps) {
  const cls = buttonClass({ variant, size, block }, className)
  if (external) {
    return (
      <a className={cls} href={String(to)} target="_blank" rel="noopener noreferrer">
        {icon}
        {children}
      </a>
    )
  }
  return (
    <Link className={cls} to={to} {...rest}>
      {icon}
      {children}
    </Link>
  )
}
