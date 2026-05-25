import { useState, useRef, useEffect } from 'react';
import styles from './BoardFramework.module.css';

export function InlineEdit({ value, onChange, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleCommit = () => {
    onChange(val);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCommit();
    } else if (e.key === 'Escape') {
      setVal(value);
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <span
        onClick={(e) => { e.stopPropagation(); setVal(value); setEditing(true); }}
        className={`${styles.inlineEditDisplay} ${className}`}
      >
        {value || "—"}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={handleCommit}
      onKeyDown={handleKeyDown}
      onClick={e => e.stopPropagation()}
      className={`${styles.inlineEditInput} ${className}`}
    />
  );
}
