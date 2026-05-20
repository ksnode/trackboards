import styles from './ConfirmModal.module.css';

/**
 * Reusable modal component for confirmations and forms.
 *
 * @param {boolean} open - Whether the modal is visible
 * @param {string} title - Bold title text
 * @param {string} [description] - Grey description text
 * @param {React.ReactNode} [children] - Optional body content (inputs, etc.)
 * @param {string} [error] - Error message to display
 * @param {string} cancelLabel - Label for cancel button
 * @param {string} confirmLabel - Label for confirm/action button
 * @param {'primary'|'danger'} [variant='primary'] - Button style variant
 * @param {boolean} [disabled=false] - Whether confirm button is disabled
 * @param {function} onCancel - Cancel handler
 * @param {function} onConfirm - Confirm handler
 */
export default function ConfirmModal({
  open,
  title,
  description,
  children,
  error,
  cancelLabel = 'Anuluj',
  confirmLabel = 'OK',
  variant = 'primary',
  disabled = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
        {children && <div className={styles.body}>{children}</div>}
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button onClick={onCancel} className={styles.cancelBtn}>{cancelLabel}</button>
          <button
            onClick={onConfirm}
            disabled={disabled}
            className={variant === 'danger' ? styles.dangerBtn : styles.confirmBtn}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
