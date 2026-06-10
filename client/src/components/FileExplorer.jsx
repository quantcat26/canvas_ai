import React, { useState, useEffect, useCallback } from 'react';
import ApiService from '../services/apiService.js';
import useCanvasStore from '../store/canvasStore.js';
import './FileExplorer.css';

const FileExplorer = ({ isOpen, onToggle, activeProjectId, onSelectProject }) => {
  const [tree, setTree] = useState({ folders: [], projects: [] });
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [loading, setLoading] = useState(false);

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
        // Get project name from tree
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
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
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

    return (
      <div key={folder.id} className="file-explorer-folder" style={{ paddingLeft: depth * 16 }}>
        <div
          className={`file-explorer-item folder ${activeProjectId === folder.id ? '' : ''}`}
          onClick={() => toggleFolder(folder.id)}
          onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
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
        className={`file-explorer-item project ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: depth * 16 + 24 }}
        onClick={() => handleOpenProject(project.id)}
        onContextMenu={(e) => handleContextMenu(e, 'project', project.id)}
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

        <div className="file-explorer-list">
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
      </div>
    </div>
  );
};

export default FileExplorer;
