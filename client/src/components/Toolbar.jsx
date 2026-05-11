import React from 'react';
import useCanvasStore from '../store/canvasStore.js';
import styles from './Toolbar.module.css';

const Toolbar = () => {
  const { selectedCardIds, removeCard, selectedConnectionIds, removeConnection } = useCanvasStore();

  const handleDeleteSelected = () => {
    selectedCardIds.forEach((id) => removeCard(id));
    selectedConnectionIds.forEach((id) => removeConnection(id));
  };

  const hasSelection = selectedCardIds.length > 0 || selectedConnectionIds.length > 0;

  return (
    <div className={styles.toolbar}>
      {hasSelection && (
        <div className={styles.toolGroup}>
          <button onClick={handleDeleteSelected} className={styles.deleteBtn}>
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Toolbar;
