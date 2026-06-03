import React, { useMemo, useState } from 'react';
import './AiConfigModal.css';

const createEmptyForm = () => ({
  id: '',
  name: '',
  baseUrl: '',
  model: '',
  apiKey: '',
  systemPrompt: '',
  temperature: '',
  maxTokens: '',
  path: '/chat/completions',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
  allowImages: false,
  allowVideos: false,
  allowPdfs: false,
  allowDocuments: false,
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
      systemPrompt: config.systemPrompt || '',
      temperature: config.temperature ?? '',
      maxTokens: config.maxTokens ?? '',
      path: config.path || '/chat/completions',
      headerName: config.headerName || 'Authorization',
      headerPrefix: config.headerPrefix ?? 'Bearer ',
      allowImages: Boolean(config.allowImages),
      allowVideos: Boolean(config.allowVideos),
      allowPdfs: Boolean(config.allowPdfs),
      allowDocuments: Boolean(config.allowDocuments),
    });
    setError('');
  };

  const handleSave = () => {
    const trimmedName = form.name.trim();
    const trimmedBaseUrl = form.baseUrl.trim();
    const trimmedModel = form.model.trim();
    const trimmedSystemPrompt = form.systemPrompt.trim();
    const parsedTemperature = form.temperature === '' ? null : Number(form.temperature);
    const parsedMaxTokens = form.maxTokens === '' ? null : Number(form.maxTokens);

    if (form.temperature !== '' && !Number.isFinite(parsedTemperature)) {
      setError('Temperature must be a valid number.');
      return;
    }

    if (form.maxTokens !== '' && (!Number.isFinite(parsedMaxTokens) || parsedMaxTokens <= 0)) {
      setError('Max tokens must be a positive number.');
      return;
    }

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
      systemPrompt: trimmedSystemPrompt,
      temperature: parsedTemperature ?? undefined,
      maxTokens: parsedMaxTokens ?? undefined,
      path: form.path.trim() || '/chat/completions',
      headerName: form.headerName.trim() || 'Authorization',
      headerPrefix: form.headerPrefix ?? 'Bearer ',
      allowImages: Boolean(form.allowImages),
      allowVideos: Boolean(form.allowVideos),
      allowPdfs: Boolean(form.allowPdfs),
      allowDocuments: Boolean(form.allowDocuments),
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
              User instruction (optional)
              <textarea
                rows={3}
                placeholder="Add a system-level instruction for the model"
                value={form.systemPrompt}
                onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              />
              <span className="ai-config-inline-hint">This instruction is sent as a system message before each request.</span>
            </label>
            <label>
              Temperature (optional)
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                placeholder="0.7"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              />
            </label>
            <label>
              Max tokens (optional)
              <input
                type="number"
                min="1"
                step="1"
                placeholder="1024"
                value={form.maxTokens}
                onChange={(e) => setForm({ ...form, maxTokens: e.target.value })}
              />
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
            <div className="ai-config-toggle-group">
              <div className="ai-config-toggle-title">Enable multimodal inputs</div>
              <label className="ai-config-toggle">
                <input
                  type="checkbox"
                  checked={form.allowImages}
                  onChange={(e) => setForm({ ...form, allowImages: e.target.checked })}
                />
                Images
              </label>
              <label className="ai-config-toggle">
                <input
                  type="checkbox"
                  checked={form.allowVideos}
                  onChange={(e) => setForm({ ...form, allowVideos: e.target.checked })}
                />
                Videos
              </label>
              <label className="ai-config-toggle">
                <input
                  type="checkbox"
                  checked={form.allowPdfs}
                  onChange={(e) => setForm({ ...form, allowPdfs: e.target.checked })}
                />
                PDFs
              </label>
              <label className="ai-config-toggle">
                <input
                  type="checkbox"
                  checked={form.allowDocuments}
                  onChange={(e) => setForm({ ...form, allowDocuments: e.target.checked })}
                />
                Documents
              </label>
              <span className="ai-config-inline-hint">Turn on only the modalities your AI provider supports.</span>
            </div>
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
