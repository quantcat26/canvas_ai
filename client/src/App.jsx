import './App.css';
import TopBar from './components/TopBar.jsx';
import FileExplorer from './components/FileExplorer.jsx';
import AiChatInput from './components/AiChatInput.jsx';
import LeftToolbar from './components/LeftToolbar.jsx';
import InfiniteCanvas from './components/InfiniteCanvas.jsx';
import AiChatContainer from './components/AiChatContainer.jsx';
import AiConfigModal from './components/AiConfigModal.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import ApiService from './services/apiService.js';
import useCanvasStore from './store/canvasStore.js';
import { getCenteredCardPosition } from './utils/canvasPosition.js';

const LAST_CANVAS_KEY = 'canvas_ai_last_canvas_id';

function App() {
  const [aiResponses, setAiResponses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [canvasName, setCanvasName] = useState('Default Canvas');
  const [hasHydrated, setHasHydrated] = useState(false);
  const isSavingRef = useRef(false);
  const [activeCanvasId, setActiveCanvasId] = useState('default');
  const [fileExplorerOpen, setFileExplorerOpen] = useState(false);
  const [aiConfigs, setAiConfigs] = useState([]);
  const [activeConfigId, setActiveConfigId] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const aiConfigLoadedRef = useRef(false);

  const CONFIGS_STORAGE_KEY = 'canvas_ai_provider_configs';
  const ACTIVE_CONFIG_KEY = 'canvas_ai_active_provider_id';

  const addCard = useCanvasStore((state) => state.addCard);
  const hydrateCanvas = useCanvasStore((state) => state.hydrate);
  const cards = useCanvasStore((state) => state.cards);
  const connections = useCanvasStore((state) => state.connections);
  const panX = useCanvasStore((state) => state.panX);
  const panY = useCanvasStore((state) => state.panY);
  const zoom = useCanvasStore((state) => state.zoom);

  const canvasStateForSave = useMemo(() => ({
    panX,
    panY,
    zoom,
    cards,
    connections,
  }), [panX, panY, zoom, cards, connections]);

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const serverData = await ApiService.getAiConfigs();
        if (Array.isArray(serverData?.configs)) {
          setAiConfigs(serverData.configs);
          if (serverData.activeConfigId) {
            setActiveConfigId(serverData.activeConfigId);
          } else if (serverData.configs.length > 0) {
            setActiveConfigId(serverData.configs[0].id);
          }
          aiConfigLoadedRef.current = true;
          return;
        }
      } catch (error) {
        console.warn('Failed to load AI settings from the server; falling back to local settings.', error);
      }

      const storedConfigs = localStorage.getItem(CONFIGS_STORAGE_KEY);
      const storedActive = localStorage.getItem(ACTIVE_CONFIG_KEY);

      if (storedConfigs) {
        try {
          const parsed = JSON.parse(storedConfigs);
          if (Array.isArray(parsed)) {
            setAiConfigs(parsed);
            if (!storedActive && parsed.length > 0) {
              setActiveConfigId(parsed[0].id);
            }
          }
        } catch (error) {
          console.warn('Unable to load AI settings:', error);
        }
      }

      if (storedActive) {
        setActiveConfigId(storedActive);
      }

      aiConfigLoadedRef.current = true;
    };

    loadConfigs();
  }, []);

  useEffect(() => {
    const safeConfigs = aiConfigs.map(({ apiKey, ...rest }) => rest);
    localStorage.setItem(CONFIGS_STORAGE_KEY, JSON.stringify(safeConfigs));
  }, [aiConfigs]);

  useEffect(() => {
    if (activeConfigId) {
      localStorage.setItem(ACTIVE_CONFIG_KEY, activeConfigId);
    }
  }, [activeConfigId]);

  useEffect(() => {
    if (!aiConfigLoadedRef.current) return;
    ApiService.saveAiConfigs({
      configs: aiConfigs,
      activeConfigId,
    }).catch((error) => {
      console.warn('Failed to save AI settings to the server:', error);
    });
  }, [aiConfigs, activeConfigId]);

  // Resolve the initial canvas ID on first mount
  useEffect(() => {
    const initCanvas = async () => {
      let resolvedId = null;

      // 1. Try the last-saved canvas ID from localStorage
      const savedId = localStorage.getItem(LAST_CANVAS_KEY);
      if (savedId) {
        try {
          await ApiService.getCanvas(savedId);
          resolvedId = savedId;
        } catch {
          // Saved ID is stale — fall through
        }
      }

      // 2. If no saved ID, try the first project from DB
      if (!resolvedId) {
        try {
          const tree = await ApiService.getProjectTree();
          const existing = tree.projects.find((p) => p.canvasCount > 0);
          if (existing) {
            resolvedId = existing.id;
          }
        } catch (e) {
          console.error('Failed to list projects:', e);
        }
      }

      // 3. Still nothing — create the first project + canvas
      if (!resolvedId) {
        try {
          const project = await ApiService.createProject('Default Project');
          const canvas = await ApiService.createCanvas(project.name, project.id);
          resolvedId = canvas.id;
          hydrateCanvas(canvas.state);
          setCanvasName(canvas.name);
          localStorage.setItem(LAST_CANVAS_KEY, canvas.id);
          setActiveCanvasId(canvas.id);
          setHasHydrated(true);
          return;
        } catch (e) {
          console.error('Failed to create default project:', e);
          setHasHydrated(true);
          return;
        }
      }

      // 4. Load the resolved canvas
      try {
        const record = await ApiService.getCanvas(resolvedId);
        hydrateCanvas(record.state);
        setCanvasName(record.name);
        localStorage.setItem(LAST_CANVAS_KEY, resolvedId);
        setActiveCanvasId(resolvedId);
        setHasHydrated(true);
      } catch (error) {
        console.error('Failed to load canvas:', error);
        setHasHydrated(true);
      }
    };

    initCanvas();
  }, []); // run once on mount

  useEffect(() => {
    if (!hasHydrated || !activeCanvasId) return;

    const timer = window.setTimeout(async () => {
      try {
        isSavingRef.current = true;
        await ApiService.saveCanvas(activeCanvasId, canvasName, canvasStateForSave);
      } catch (error) {
        console.error('Failed to save canvas:', error);
      } finally {
        isSavingRef.current = false;
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [canvasStateForSave, canvasName, activeCanvasId, hasHydrated]);

  const handleAiSubmit = async (message, configId, attachments = []) => {
    try {
      setIsLoading(true);
      console.log('Sending to AI:', message, 'configId:', configId);

      const response = await ApiService.sendChatMessage(message, configId, attachments);
      setAiResponses((prev) => [...prev, response]);
    } catch (error) {
      console.error('AI request failed:', error);
      let messageText = 'Request failed. Please try again later.';

      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data?.error;
        const status = error.response?.status;
        const details = apiError?.details || {};
        const detailLines = [];

        if (apiError?.message) {
          messageText = apiError.message;
        } else if (error.message) {
          messageText = error.message;
        }

        if (apiError?.code) detailLines.push(`Code: ${apiError.code}`);
        if (status) detailLines.push(`Status: ${status}`);
        if (details.providerMessage) {
          detailLines.push(`Reason: ${details.providerMessage}`);
        } else if (details.message) {
          detailLines.push(`Reason: ${details.message}`);
        }

        if (detailLines.length > 0) {
          messageText = `${messageText}\n\n${detailLines.join('\n')}`;
        }
      }

      setAiResponses((prev) => [...prev, {
        text: messageText,
        source: 'Error',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = (config) => {
    setAiConfigs((prev) => {
      const index = prev.findIndex((item) => item.id === config.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = config;
        return next;
      }
      return [...prev, config];
    });

    if (!activeConfigId) {
      setActiveConfigId(config.id);
    }
  };

  const handleDeleteConfig = (id) => {
    setAiConfigs((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (activeConfigId === id) {
        setActiveConfigId(next[0]?.id || '');
      }
      return next;
    });
  };

  const handleSelectProject = (projectId, projectName) => {
    setActiveCanvasId(projectId);
    setCanvasName(projectName || 'Untitled');
    setFileExplorerOpen(false);
    localStorage.setItem(LAST_CANVAS_KEY, projectId);
    // Clear AI responses when switching canvas
    setAiResponses([]);
  };

  const handleCloseAiResponse = (index) => {
    setAiResponses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddResponseToCanvas = (response) => {
    const contentLength = response.text.length;
    const baseWidth = 320;
    let cardHeight = 200;

    if (contentLength > 500) {
      cardHeight = 350;
    } else if (contentLength > 200) {
      cardHeight = 280;
    }

    const size = { width: baseWidth, height: cardHeight };

    addCard({
      type: 'text',
      content: response.text,
      position: getCenteredCardPosition({ size, panX, panY, zoom }),
      size,
    });

    const index = aiResponses.findIndex((item) => item.text === response.text);
    if (index !== -1) {
      handleCloseAiResponse(index);
    }
  };

  return (
    <div className="app-container">
      <TopBar onOpenSettings={() => setIsConfigOpen(true)} onOpenFileExplorer={() => setFileExplorerOpen(true)} />

      <div className="main-content">
        <LeftToolbar />
        <InfiniteCanvas />
        <AiChatContainer
          responses={aiResponses}
          onClose={handleCloseAiResponse}
          onAddToCanvas={handleAddResponseToCanvas}
        />
      </div>

      <FileExplorer
        isOpen={fileExplorerOpen}
        onToggle={() => setFileExplorerOpen(false)}
        activeProjectId={activeCanvasId}
        onSelectProject={handleSelectProject}
      />

      <AiChatInput
        onAiSubmit={handleAiSubmit}
        isLoading={isLoading}
        configs={aiConfigs}
        activeConfigId={activeConfigId}
        onSelectConfig={setActiveConfigId}
        onOpenSettings={() => setIsConfigOpen(true)}
      />

      <AiConfigModal
        isOpen={isConfigOpen}
        configs={aiConfigs}
        activeConfigId={activeConfigId}
        onClose={() => setIsConfigOpen(false)}
        onSaveConfig={handleSaveConfig}
        onDeleteConfig={handleDeleteConfig}
        onSelectConfig={setActiveConfigId}
      />
    </div>
  );
}

export default App;
