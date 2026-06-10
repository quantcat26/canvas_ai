import React, { useState, useEffect, useCallback } from 'react';
import ApiService from '../services/apiService.js';
import useCanvasStore from '../store/canvasStore.js';
import './FileExplorer.css';

const MoveDialog = ({ moveDialog, tree, onConfirm, onCancel }) => {
  if (!moveDialog) return null;

  const buildFolderOptions = (folders, parentId = null, depth = 0) => {
    const children = folders.filter((f) => f.parentFolderId === parentId);
    if (children.length === 0) return null;

    return children.map((folder) => {
      const isSelf = moveDialog.type === 'folder' && moveDialog.id === folder.id;
      return (
        <React.Fragment key={folder.id}>
          {!isSelf && (
            <option value={folder.id}>
              {'　'.repeat(depth)}{depth > 0 ? '└ ' : ''}📁 {folder.name}
            </option>
          )}
          {buildFolderOptions(folders, folder.id, depth + 1)}
        </React.Fragment>
      );
    });
  };

  const currentFolderId = moveDialog.type === 'project'
    ? tree.projects.find((p) => p.id === moveDialog.id)?.folderId
    : tree.folders.find((f) => f.id === moveDialog.id)?.parentFolderId;

  return (
    <>
      <div className="file-explorer-context-overlay" onClick={onCancel} />
      <div className="move-dialog">
        <h3 className="move-dialog-title">Move &quot;{moveDialog.name}&quot;</h3>
        <select
          className="move-dialog-select"
          size={Math.min(tree.folders.length + 1, 12)}
          defaultValue={currentFolderId || '__root__'}
          onChange={(e) => {
            const val = e.target.value;
            onConfirm(val === '__root__' ? null : val);
          }}
        >
          <option value="__root__">📂 Root (no folder)</option>
          {buildFolderOptions(tree.folders, null)}
        </select>
        <div className="move-dialog-actions">
          <button className="move-dialog-btn cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </>
  );
};

const FileExplorer = ({ isOpen, onToggle, activeProjectId, onSelectProject }) => {
  const [tree, setTree] = useState({ folders: [], projects: [] });
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [loading, setLoading] = useState(false);
  const [moveDialog, setMoveDialog] = useState(null);
  const [dragState, setDragState] = useState(null);

  const hydrateCanvas = useCanvasStore((state) => state.hydrate);

  const loadTree = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ApiService.getProjectTree();
      setTree(data);
    } catch (error) {
      console.error('Failed to load project tree:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadTree();
    }
  }, [isOpen, loadTree]);

  const handleCreateProject = async (folderId = null) => {
    const name = window.prompt('Enter project name:');
    if (!name || !name.trim()) return;
    try {
      await ApiService.createProject(name.trim(), folderId);
      await loadTree();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleCreateFolder = async (parentFolderId = null) => {
    const name = window.prompt('Enter folder name:');
    if (!name || !name.trim()) return;
    try {
      await ApiService.createFolder(name.trim(), parentFolderId);
      await loadTree();
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleOpenProject = async (projectId) => {
    try {
      const record = await ApiService.getCanvas(projectId);
      hydrateCanvas(record.state);
      if (onSelectProject) {
        onSelectProject(projectId, record.name);
      }
    } catch (error) {
      const isNotFound = error?.response?.status === 404;
      if (isNotFound) {
        const project = tree.projects.find((p) => p.id === projectId);
        const projectName = project?.name || 'Untitled';
        const created = await ApiService.createCanvas(projectName, projectId);
        hydrateCanvas(created.state);
        if (onSelectProject) {
          onSelectProject(created.id, created.name);
        }
      } else {
        console.error('Failed to load project canvas:', error);
      }
    }
  };

  const handleStartRename = (type, id, currentName) => {
    setRenaming({ type, id });
    setRenameValue(currentName);
  };

  const handleFinishRename = async () => {
    if (!renaming || !renameValue.trim()) {
      setRenaming(null);
      return;
    }
    try {
      if (renaming.type === 'project') {
        await ApiService.updateProject(renaming.id, { name: renameValue.trim() });
      } else if (renaming.type === 'folder') {
        await ApiService.updateFolder(renaming.id, { name: renameValue.trim() });
      }
      await loadTree();
    } catch (error) {
      console.error('Failed to rename:', error);
    }
    setRenaming(null);
  };

  const handleDelete = async (type, id) => {
    const item = type === 'project'
      ? tree.projects.find((p) => p.id === id)
      : tree.folders.find((f) => f.id === id);
    const label = item?.name || id;
    if (!window.confirm('Delete "' + label + '"? This cannot be undone.')) return;
    try {
      if (type === 'project') {
        await ApiService.deleteProject(id);
      } else {
        await ApiService.deleteFolder(id);
      }
      await loadTree();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleContextMenu = (e, type, id) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ type, id, x: rect.right, y: rect.top });
  };

  const handleMoveStart = (type, id) => {
    const item = type === 'project'
      ? tree.projects.find((p) => p.id === id)
      : tree.folders.find((f) => f.id === id);
    setMoveDialog({ type, id, name: item?.name || id });
    setContextMenu(null);
  };

  const handleMoveConfirm = async (targetFolderId) => {
    if (!moveDialog) return;
    if (moveDialog.type === 'folder' && moveDialog.id === targetFolderId) {
      window.alert('Cannot move a folder into itself.');
      return;
    }
    try {
      if (moveDialog.type === 'project') {
        await ApiService.updateProject(moveDialog.id, { folderId: targetFolderId || null });
      } else if (moveDialog.type === 'folder') {
        await ApiService.updateFolder(moveDialog.id, { parentFolderId: targetFolderId || null });
      }
      await loadTree();
    } catch (error) {
      console.error('Failed to move:', error);
    }
    setMoveDialog(null);
  };

  const handleDragStart = (e, type, id) => {
    e.stopPropagation();
    const item = type === 'project'
      ? tree.projects.find((p) => p.id === id)
      : tree.folders.find((f) => f.id === id);
    e.dataTransfer.setData('application/x-file-explorer', JSON.stringify({ type, id }));
    e.dataTransfer.effectAllowed = 'move';
    setDragState({ type, id, name: item?.name || id });
  };

  const handleDragEnd = () => {
    setDragState(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetFolderId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState(null);

    const raw = e.dataTransfer.getData('application/x-file-explorer');
    if (!raw) return;
    let dragData;
    try {
      dragData = JSON.parse(raw);
    } catch {
      return;
    }
    const { type, id } = dragData;
    if (!type || !id) return;

    if (type === 'folder' && id === targetFolderId) return;

    // Check descendant to prevent moving folder into its own subtree
    const isDescendant = (folderId, ancestorId) => {
      const subFolders = tree.folders.filter((f) => f.parentFolderId === ancestorId);
      for (const f of subFolders) {
        if (f.id === folderId) return true;
        if (isDescendant(folderId, f.id)) return true;
      }
      return false;
    };
    if (type === 'folder' && targetFolderId && isDescendant(targetFolderId, id)) return;

    try {
      if (type === 'project') {
        await ApiService.updateProject(id, { folderId: targetFolderId || null });
      } else if (type === 'folder') {
        await ApiService.updateFolder(id, { parentFolderId: targetFolderId || null });
      }
      await loadTree();
    } catch (error) {
      console.error('Failed to move via drag:', error);
    }
  };

  const handleRootDrop = async (e) => {
    await handleDrop(e, null);
  };

  const toggleFolder = (folderId) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const renderFolder = (folder, depth = 0) => {
    const isCollapsed = collapsedFolders[folder.id] !== false;
    const subFolders = tree.folders.filter((f) => f.parentFolderId === folder.id);
    const folderProjects = tree.projects.filter((p) => p.folderId === folder.id);
    const isRenaming = renaming?.type === 'folder' && renaming?.id === folder.id;
    const isDropTargetFolder = dragState !== null && dragState.id !== folder.id;

    return (
      <div key={folder.id} style={{ paddingLeft: depth * 16 }}>
        <div
          className={'file-explorer-item folder' + (isDropTargetFolder ? ' drop-target' : '')}
          onClick={() => toggleFolder(folder.id)}
          onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
          draggable
          onDragStart={(e) => handleDragStart(e, 'folder', folder.id)}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, folder.id)}
        >
          <span className="file-explorer-chevron">{isCollapsed ? '▶' : '▼'}</span>
          <span className="file-explorer-icon">📁</span>
          {isRenaming ? (
            <input
              className="file-explorer-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleFinishRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishRename();
                if (e.key === 'Escape') setRenaming(null);
              }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="file-explorer-name">{folder.name}</span>
          )}
          <div className="file-explorer-actions">
            <button
              className="file-explorer-action-btn"
              title="New project in folder"
              onClick={(e) => { e.stopPropagation(); handleCreateProject(folder.id); }}
            >
              +
            </button>
          </div>
        </div>
        {!isCollapsed && (
          <>
            {subFolders.map((f) => renderFolder(f, depth + 1))}
            {folderProjects.map((p) => renderProject(p, depth + 1))}
            {subFolders.length === 0 && folderProjects.length === 0 && (
              <div className="file-explorer-empty" style={{ paddingLeft: (depth + 1) * 16 + 24 }}>
                Empty folder
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderProject = (project, depth = 0) => {
    const isActive = activeProjectId === project.id;
    const isRenaming = renaming?.type === 'project' && renaming?.id === project.id;

    return (
      <div
        key={project.id}
        className={'file-explorer-item project' + (isActive ? ' active' : '')}
        style={{ paddingLeft: depth * 16 + 24 }}
        onClick={() => handleOpenProject(project.id)}
        onContextMenu={(e) => handleContextMenu(e, 'project', project.id)}
        draggable
        onDragStart={(e) => handleDragStart(e, 'project', project.id)}
        onDragEnd={handleDragEnd}
      >
        <span className="file-explorer-icon">{isActive ? '📄' : '📃'}</span>
        {isRenaming ? (
          <input
            className="file-explorer-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleFinishRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFinishRename();
              if (e.key === 'Escape') setRenaming(null);
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="file-explorer-name">{project.name}</span>
        )}
      </div>
    );
  };

  const rootFolders = tree.folders.filter((f) => !f.parentFolderId);
  const rootProjects = tree.projects.filter((p) => !p.folderId);

  if (!isOpen) return null;

  return (
    <div className="file-explorer-overlay" onClick={onToggle}>
      <div className="file-explorer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="file-explorer-header">
          <h2 className="file-explorer-title">Projects</h2>
          <button className="file-explorer-close-btn" onClick={onToggle}>✕</button>
        </div>

        <div className="file-explorer-toolbar">
          <button className="file-explorer-toolbar-btn" onClick={() => handleCreateProject(null)}>
            + New Project
          </button>
          <button className="file-explorer-toolbar-btn" onClick={() => handleCreateFolder(null)}>
            + New Folder
          </button>
        </div>

        <div
          className={'file-explorer-list' + (dragState ? ' drag-active' : '')}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={handleRootDrop}
        >
          {loading && <div className="file-explorer-loading">Loading...</div>}
          {!loading && (
            <>
              {rootFolders.map((f) => renderFolder(f))}
              {rootProjects.map((p) => renderProject(p))}
              {rootFolders.length === 0 && rootProjects.length === 0 && !loading && (
                <div className="file-explorer-empty">No projects yet. Create one to get started.</div>
              )}
            </>
          )}
          {dragState && (
            <div className="file-explorer-drop-zone">
              <span>Drop here to move to root</span>
            </div>
          )}
        </div>

        {contextMenu && (
          <div
            className="file-explorer-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => {
                const item = contextMenu.type === 'project'
                  ? tree.projects.find((p) => p.id === contextMenu.id)
                  : tree.folders.find((f) => f.id === contextMenu.id);
                handleStartRename(contextMenu.type, contextMenu.id, item?.name || '');
                setContextMenu(null);
              }}
            >
              Rename
            </button>
            <button
              onClick={() => {
                handleMoveStart(contextMenu.type, contextMenu.id);
              }}
            >
              Move to...
            </button>
            <button
              className="danger"
              onClick={() => {
                handleDelete(contextMenu.type, contextMenu.id);
                setContextMenu(null);
              }}
            >
              Delete
            </button>
          </div>
        )}

        {contextMenu && (
          <div
            className="file-explorer-context-overlay"
            onClick={() => setContextMenu(null)}
          />
        )}

        <MoveDialog
          moveDialog={moveDialog}
          tree={tree}
          onConfirm={handleMoveConfirm}
          onCancel={() => setMoveDialog(null)}
        />
      </div>
    </div>
  );
};

export default FileExplorer;
