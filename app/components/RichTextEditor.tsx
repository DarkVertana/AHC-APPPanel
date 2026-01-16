'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Enter your content here...',
  className = '',
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[300px] p-4 text-[#435970]',
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className={`border border-[#dfedfb] rounded-lg bg-white ${className}`}>
      {/* Toolbar */}
      <div className="border-b border-[#dfedfb] p-2 flex flex-wrap gap-2 bg-gray-50 rounded-t-lg">
        {/* Text Formatting */}
        <div className="flex gap-1 border-r border-[#dfedfb] pr-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-[#dfedfb] transition-colors ${
              editor.isActive('bold') ? 'bg-[#7895b3] text-white' : 'text-[#435970]'
            }`}
            title="Bold"
          >
            <strong className="text-sm">B</strong>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-[#dfedfb] transition-colors ${
              editor.isActive('italic') ? 'bg-[#7895b3] text-white' : 'text-[#435970]'
            }`}
            title="Italic"
          >
            <em className="text-sm">I</em>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={!editor.can().chain().focus().toggleStrike().run()}
            className={`p-2 rounded hover:bg-[#dfedfb] transition-colors ${
              editor.isActive('strike') ? 'bg-[#7895b3] text-white' : 'text-[#435970]'
            }`}
            title="Strikethrough"
          >
            <span className="text-sm line-through">S</span>
          </button>
        </div>

        {/* Headings */}
        <div className="flex gap-1 border-r border-[#dfedfb] pr-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-2 rounded hover:bg-[#dfedfb] transition-colors text-xs font-bold ${
              editor.isActive('heading', { level: 1 }) ? 'bg-[#7895b3] text-white' : 'text-[#435970]'
            }`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-2 rounded hover:bg-[#dfedfb] transition-colors text-xs font-bold ${
              editor.isActive('heading', { level: 2 }) ? 'bg-[#7895b3] text-white' : 'text-[#435970]'
            }`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-2 rounded hover:bg-[#dfedfb] transition-colors text-xs font-bold ${
              editor.isActive('heading', { level: 3 }) ? 'bg-[#7895b3] text-white' : 'text-[#435970]'
            }`}
            title="Heading 3"
          >
            H3
          </button>
        </div>

        {/* Lists */}
        <div className="flex gap-1 border-r border-[#dfedfb] pr-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-[#dfedfb] transition-colors ${
              editor.isActive('bulletList') ? 'bg-[#7895b3] text-white' : 'text-[#435970]'
            }`}
            title="Bullet List"
          >
            <span className="text-sm">•</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded hover:bg-[#dfedfb] transition-colors ${
              editor.isActive('orderedList') ? 'bg-[#7895b3] text-white' : 'text-[#435970]'
            }`}
            title="Numbered List"
          >
            <span className="text-sm">1.</span>
          </button>
        </div>

        {/* Blockquote */}
        <div className="flex gap-1 border-r border-[#dfedfb] pr-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-2 rounded hover:bg-[#dfedfb] transition-colors ${
              editor.isActive('blockquote') ? 'bg-[#7895b3] text-white' : 'text-[#435970]'
            }`}
            title="Quote"
          >
            <span className="text-sm">&quot;</span>
          </button>
        </div>

        {/* Link */}
        <div className="flex gap-1 border-r border-[#dfedfb] pr-2">
          <button
            type="button"
            onClick={() => {
              const url = window.prompt('Enter URL:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            className={`p-2 rounded hover:bg-[#dfedfb] transition-colors ${
              editor.isActive('link') ? 'bg-[#7895b3] text-white' : 'text-[#435970]'
            }`}
            title="Add Link"
          >
            <span className="text-sm">🔗</span>
          </button>
        </div>

        {/* Code */}
        <div className="flex gap-1 border-r border-[#dfedfb] pr-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-2 rounded hover:bg-[#dfedfb] transition-colors ${
              editor.isActive('code') ? 'bg-[#7895b3] text-white' : 'text-[#435970]'
            }`}
            title="Code"
          >
            <span className="text-sm font-mono">&lt;/&gt;</span>
          </button>
        </div>

        {/* Undo/Redo */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className="p-2 rounded hover:bg-[#dfedfb] transition-colors text-[#435970] disabled:opacity-50"
            title="Undo"
          >
            <span className="text-sm">↶</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className="p-2 rounded hover:bg-[#dfedfb] transition-colors text-[#435970] disabled:opacity-50"
            title="Redo"
          >
            <span className="text-sm">↷</span>
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="rounded-b-lg">
        <EditorContent editor={editor} />
      </div>

      {/* HTML Code View Toggle */}
      <div className="border-t border-[#dfedfb] p-2 bg-gray-50 rounded-b-lg">
        <button
          type="button"
          onClick={() => {
            const htmlContent = editor.getHTML();
            const textarea = document.createElement('textarea');
            textarea.value = htmlContent;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('HTML code copied to clipboard!');
          }}
          className="text-xs text-[#7895b3] hover:text-[#435970] transition-colors"
        >
          📋 Copy HTML
        </button>
      </div>
    </div>
  );
}

