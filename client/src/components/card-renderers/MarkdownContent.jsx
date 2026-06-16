import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './MarkdownContent.css';

const stopPropagation = (event) => {
  event.stopPropagation();
};

const MarkdownContent = ({ content, className = '' }) => {
  const markdown = content || 'Click to edit text content';

  return (
    <div
      className={`markdown-content ${className}`.trim()}
      onMouseDown={stopPropagation}
      onClick={stopPropagation}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ node, ...props }) => (
            <a
              {...props}
              onMouseDown={stopPropagation}
              onClick={stopPropagation}
              target="_blank"
              rel="noreferrer"
            />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownContent;
