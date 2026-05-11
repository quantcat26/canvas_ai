import React, { useMemo, useState } from 'react';
import './AiConfigModal.css';

const createEmptyForm = () => ({
  id: '',
  name: '',
  baseUrl: '',
  model: '',
  apiKey: '',
  path: '/chat/completions',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
});

const AiConfigModal = ({
  isOpen,
  configs,
  activeConfigId,
  onClose,
  onSaveConfig,
  onDeleteConfig,
  onSelectConfig,
}) => {
  const [form, setForm] = useState(createEmptyForm());
  const [error, setError] = useState('');

  const activeConfig = useMemo(() => {
    return configs.find((item) => item.id === activeConfigId) || null;
  }, [configs, activeConfigId]);

  const resetForm = () => {
    setForm(createEmptyForm());
    setError('');
  };

  const handleEdit = (config) => {
    setForm({
      id: config.id,
      name: config.name || '',
      baseUrl: config.baseUrl || '',
      model: config.model || '',
      apiKey: '',
      path: config.path || '/chat/completions',
      headerName: config.headerName || 'Authorization',
      headerPrefix: config.headerPrefix ?? 'Bearer ',
    });
    setError('');
  };

  const handleSave = () => {
    const trimmedName = form.name.trim();
    const trimmedBaseUrl = form.baseUrl.trim();
    const trimmedModel = form.model.trim();

    if (!trimmedName || !trimmedBaseUrl || !trimmedModel) {
      setError('Name, Base URL, and Model are required.');
      return;
    }

    const id = form.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cfg_${Date.now()}`);

    onSaveConfig({
      id,
      name: trimmedName,
      baseUrl: trimmedBaseUrl,
      model: trimmedModel,
      apiKey: form.apiKey.trim(),
      path: form.path.trim() || '/chat/completions',
      headerName: form.headerName.trim() || 'Authorization',
      headerPrefix: form.headerPrefix ?? 'Bearer ',
    });

    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="ai-config-overlay" onClick={onClose}>
      <div className="ai-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-config-header">
          <div>
            <h2>AI API Settings</h2>
            <p>Supports OpenAI-compatible APIs and multiple model configurations.</p>
          </div>
          <button className="ai-config-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="ai-config-section">
          <div className="ai-config-section-title">Configured Models</div>
          <div className="ai-config-list">
            {configs.length === 0 && (
              <div className="ai-config-empty">No models have been created yet. Add one below.</div>
            )}
            {configs.map((config) => (
              <div
                key={config.id}
                className={`ai-config-card ${config.id === activeConfigId ? 'active' : ''}`}
              >
                <div>
                  <div className="ai-config-name">{config.name}</div>
                  <div className="ai-config-meta">{config.model} · {config.baseUrl}</div>
                </div>
                <div className="ai-config-actions">
                  <button
                    className="ai-config-action"
                    onClick={() => onSelectConfig(config.id)}
                  >
                    {config.id === activeConfigId ? 'Active' : 'Use'}
                  </button>
                  <button className="ai-config-action" onClick={() => handleEdit(config)}>Edit</button>
                  <button className="ai-config-action danger" onClick={() => onDeleteConfig(config.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ai-config-section">
          <div className="ai-config-section-title">Add / Edit Model</div>
          <div className="ai-config-form">
            <label>
              Display Name
              <input
                type="text"
                placeholder="ChatGPT 5.0"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Base URL
              <input
                type="text"
                placeholder="https://api.openai.com/v1"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              />
            </label>
            <label>
              Model
              <input
                type="text"
                placeholder="gpt-4o-mini"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </label>
            <label>
              API Key
              <input
                type="password"
                placeholder="Leave blank to keep the existing key"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              />
              <span className="ai-config-inline-hint">Leaving this blank keeps the key already saved on the server.</span>
            </label>
            <label>
              Path (optional)
              <input
                type="text"
                placeholder="/chat/completions"
                value={form.path}
                onChange={(e) => setForm({ ...form, path: e.target.value })}
              />
            </label>
            <label>
              Header Name (optional)
              <input
                type="text"
                placeholder="Authorization"
                value={form.headerName}
                onChange={(e) => setForm({ ...form, headerName: e.target.value })}
              />
            </label>
            <label>
              Header Prefix (optional)
              <input
                type="text"
                placeholder="Bearer "
                value={form.headerPrefix}
                onChange={(e) => setForm({ ...form, headerPrefix: e.target.value })}
              />
            </label>
          </div>
          {error && <div className="ai-config-error">{error}</div>}
          <div className="ai-config-footer">
            <button className="ai-config-reset" onClick={resetForm}>Clear</button>
            <button className="ai-config-save" onClick={handleSave}>
              Save Settings
            </button>
          </div>
          {activeConfig && (
            <div className="ai-config-note">
              Active now: {activeConfig.name} · {activeConfig.model}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiConfigModal;
