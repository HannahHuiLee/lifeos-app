// 文件路径: app/create-note/page.tsx
'use client'; // 必须加这一行！

import { useState } from 'react';

export default function CreateNotePage() {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return; // 如果没输入内容，不让提交
    
    setIsSubmitting(true);
    
    // 调用我们刚才写的后端 API
    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    if (response.ok) {
      alert('💾 保存成功！');
      setContent(''); // 清空输入框
    } else {
      alert('❌ 保存失败，请重试。');
    }
    
    setIsSubmitting(false);
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      {/* 页面标题 */}
      <h1 style={{ fontSize: '2rem', color: '#059669' }}>📝 新建记录</h1>
      <p style={{ marginTop: '10px', color: '#666' }}>输入你的想法或待办事项，然后保存：</p>

      {/* 输入框 */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="在这里输入内容..."
        style={{
          width: '100%',
          height: '150px',
          marginTop: '20px',
          padding: '12px',
          fontSize: '1rem',
          borderRadius: '8px',
          border: '1px solid #d1d5db',
          resize: 'vertical',
          boxSizing: 'border-box',
          outline: 'none'
        }}
      />

      {/* 保存按钮 */}
      <button
        onClick={handleSave}
        disabled={isSubmitting || !content.trim()}
        style={{
          marginTop: '20px',
          padding: '12px 24px',
          fontSize: '1rem',
          fontWeight: 'bold',
          color: 'white',
          backgroundColor: isSubmitting ? '#9ca3af' : '#059669',
          border: 'none',
          borderRadius: '8px',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s'
        }}
      >
        {isSubmitting ? '保存中...' : '💾 Save 保存'}
      </button>
    </div>
  );
}