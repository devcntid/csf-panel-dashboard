'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  type LucideIcon,
} from 'lucide-react'

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
}

function ToolbarButton({
  onMouseDown,
  active,
  disabled,
  icon: Icon,
  title,
}: {
  onMouseDown: (e: React.MouseEvent) => void
  active?: boolean
  disabled?: boolean
  icon: LucideIcon
  title: string
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) onMouseDown(e)
      }}
      disabled={disabled}
      title={title}
      className={cn(
        'p-2 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50',
        active && 'bg-teal-100 text-teal-700'
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Ketik di sini...',
  className,
  minHeight = '100px',
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [htmlView, setHtmlView] = useState(false)
  const [plainHtml, setPlainHtml] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[80px] px-3 py-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5',
      },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const normalized = value || '<p></p>'
    if (current !== normalized) {
      editor.commands.setContent(normalized, false)
    }
  }, [value, editor])

  const handleListCommand = (command: 'toggleBulletList' | 'toggleOrderedList') => {
    if (!editor) return
    const { from, to } = editor.state.selection
    editor.chain().focus().setTextSelection({ from, to })[command]().run()
  }

  const handleToggleHtmlView = () => {
    if (!editor) return
    if (htmlView) {
      try {
        editor.commands.setContent(plainHtml || '<p></p>', false)
        onChangeRef.current(plainHtml || '<p></p>')
      } catch {
        // invalid html, keep previous
      }
      setHtmlView(false)
    } else {
      setPlainHtml(editor.getHTML())
      setHtmlView(true)
    }
  }

  if (!editor) {
    return (
      <div
        className={cn('rounded-md border border-slate-200 bg-slate-50 animate-pulse', className)}
        style={{ minHeight }}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-md border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500',
        className
      )}
      style={{ minHeight }}
    >
      {/* Toolbar Tiptap - onMouseDown preventDefault agar fokus tetap di editor saat klik tombol */}
      <div
        className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1 py-1 rounded-t-md"
        onMouseDown={(e) => {
          e.preventDefault()
        }}
      >
        <ToolbarButton
          onMouseDown={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          icon={Bold}
          title="Tebal"
        />
        <ToolbarButton
          onMouseDown={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          icon={Italic}
          title="Miring"
        />
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <ToolbarButton
          onMouseDown={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          icon={Heading2}
          title="Judul 2"
        />
        <ToolbarButton
          onMouseDown={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          icon={Heading3}
          title="Judul 3"
        />
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <ToolbarButton
          onMouseDown={() => handleListCommand('toggleBulletList')}
          active={editor.isActive('bulletList')}
          icon={List}
          title="Daftar bullet"
        />
        <ToolbarButton
          onMouseDown={() => handleListCommand('toggleOrderedList')}
          active={editor.isActive('orderedList')}
          icon={ListOrdered}
          title="Daftar nomor"
        />
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleToggleHtmlView()
          }}
          title={htmlView ? 'Tampilkan editor' : 'Tampilkan HTML'}
          className={cn(
            'px-2 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            htmlView && 'bg-teal-100 text-teal-700'
          )}
        >
          {htmlView ? 'Editor' : 'HTML'}
        </button>
      </div>
      {htmlView ? (
        <textarea
          value={plainHtml}
          onChange={(e) => setPlainHtml(e.target.value)}
          className="w-full min-h-[200px] p-3 text-sm font-mono border-0 border-t border-slate-200 focus:outline-none focus:ring-0 resize-y"
          placeholder="Edit HTML di sini..."
          spellCheck={false}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  )
}
