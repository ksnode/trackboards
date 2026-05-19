import styles from './BoardFramework.module.css';

export function Checkbox({ state, color, size = 18, onClick }) {
  const isDone = state === 'done';
  const isSkip = state === 'skip';
  const isPartial = state === 'partial';

  const filled = isDone || isSkip || isPartial;
  const bg = isDone ? color : isSkip ? '#999' : isPartial ? color : 'var(--color-bg)';

  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={styles.checkbox}
      style={{
        width: size,
        height: size,
        background: bg,
        border: filled ? 'none' : '2px solid #888',
      }}
    >
      {isDone && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {isSkip && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      {isPartial && (
        <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
          <path d="M1 1H9" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
