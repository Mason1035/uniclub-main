/**
 * Shared presentational primitives for the ClassHub admin console.
 * Uses existing shared Button/Dialog primitives and theme tokens, inheriting
 * both light and dark themes from the app.
 */
import React from 'react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { AlertCircle, Loader2, X } from 'lucide-react';

/* ---------------------------------------------------------------- */
/* Layout helpers                                                    */
/* ---------------------------------------------------------------- */

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Panel: React.FC<{
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
}> = ({ title, description, actions, children, padded = true }) => (
  <section className="rounded-sm border border-border bg-card  overflow-hidden">
    {(title || actions) && (
      <header className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
    )}
    <div className={padded ? 'p-5' : ''}>{children}</div>
  </section>
);

export const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
}> = ({ icon, label, value, hint }) => (
  <div className="rounded-sm border border-border bg-card p-5  transition-colors hover:border-primary/40">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
        {icon}
      </span>
    </div>
  </div>
);

/* ---------------------------------------------------------------- */
/* Buttons                                                           */
/* ---------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline';

// Pass the semantic variant through; className alone leaves the shared default
// primary background on ghost buttons.
const sharedButtonVariant = {
  primary: 'default',
  secondary: 'outline',
  ghost: 'ghost',
  danger: 'destructive',
  'danger-outline': 'outline',
} as const;

const buttonStyles: Record<ButtonVariant, string> = {
  primary: '',
  secondary: 'border-border bg-card text-foreground hover:bg-secondary hover:text-foreground',
  ghost: 'bg-transparent text-foreground hover:bg-secondary hover:text-foreground',
  danger: '',
  'danger-outline': 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive',
};

export const AdminButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }
> = ({ variant = 'primary', loading = false, className = '', children, disabled, ...rest }) => (
  <Button
    {...rest}
    variant={sharedButtonVariant[variant]}
    loading={loading}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 rounded-sm min-h-11 px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
  >
    {children}
  </Button>
);

/* ---------------------------------------------------------------- */
/* States                                                            */
/* ---------------------------------------------------------------- */

export const LoadingState: React.FC<{ label?: string }> = ({ label = '加载中…' }) => (
  <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
    <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
    {label}
  </div>
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
      <AlertCircle className="h-5 w-5" />
    </span>
    <p className="text-sm text-foreground">{message}</p>
    {onRetry && (
      <AdminButton variant="secondary" onClick={onRetry}>
        重试
      </AdminButton>
    )}
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
    <p className="text-sm font-medium text-foreground">{title}</p>
    {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

/* ---------------------------------------------------------------- */
/* Badge                                                             */
/* ---------------------------------------------------------------- */

const badgeTones = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-primary/15 text-primary dark:text-primary',
  warning: 'bg-primary/15 text-foreground dark:text-foreground',
  danger: 'bg-destructive/15 text-destructive dark:text-destructive',
  info: 'bg-primary/15 text-primary dark:text-primary',
} as const;

export const Badge: React.FC<{ tone?: keyof typeof badgeTones; children: React.ReactNode }> = ({
  tone = 'neutral',
  children,
}) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${badgeTones[tone]}`}
  >
    {children}
  </span>
);

/* ---------------------------------------------------------------- */
/* Form fields                                                       */
/* ---------------------------------------------------------------- */

export const Field: React.FC<{
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, hint, required, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-medium text-foreground">
      {label}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
  </label>
);

const controlClass =
  'w-full min-h-11 rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20';

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...rest
}) => <input {...rest} className={`${controlClass} ${className}`} />;

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = '',
  ...rest
}) => <textarea {...rest} className={`${controlClass} min-h-[96px] resize-y ${className}`} />;

export const SelectInput: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }
> = ({ options, className = '', ...rest }) => (
  <select {...rest} className={`${controlClass} ${className}`}>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

/* ---------------------------------------------------------------- */
/* Modal                                                             */
/* ---------------------------------------------------------------- */

export const Modal: React.FC<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}> = ({ open, title, description, onClose, footer, children, width = 'max-w-2xl' }) => {
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent className={width}><DialogTitle>{title}</DialogTitle>{description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}管理表单</DialogDescription>}<div className="py-4">{children}</div>{footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">{footer}</footer>}</DialogContent></Dialog>;
};

/* ---------------------------------------------------------------- */
/* Table + pagination                                                */
/* ---------------------------------------------------------------- */

export const DataTable: React.FC<{
  head: React.ReactNode;
  children: React.ReactNode;
}> = ({ head, children }) => (
  <div className="w-full overflow-x-auto">
    <table className="w-full min-w-[720px] border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          {head}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

export const Th: React.FC<{ children?: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;

export const Td: React.FC<{ children?: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <td className={`px-4 py-3 align-middle text-foreground ${className}`}>{children}</td>;

export const Tr: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tr className="border-b border-border/70 last:border-0 hover:bg-accent/5">{children}</tr>
);

export const Pagination: React.FC<{
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}> = ({ page, pages, total, onChange }) => (
  <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
    <span>
      共 {total} 条 · 第 {page} / {pages} 页
    </span>
    <div className="flex items-center gap-2">
      <AdminButton variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        上一页
      </AdminButton>
      <AdminButton variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        下一页
      </AdminButton>
    </div>
  </div>
);

