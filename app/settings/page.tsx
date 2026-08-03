// 文件路径: app/settings/page.tsx (或 src/app/settings/page.tsx)

export default function SettingsPage() {
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '2rem', color: '#dc2626' }}>⚙️ 设置 (Settings)</h1>
      <p style={{ marginTop: '20px', fontSize: '1.2rem', color: '#555' }}>
        在这里管理你的 LifeOS 偏好设置。
      </p>
      <div style={{ marginTop: '30px' }}>
        <label style={{ display: 'block', marginBottom: '15px' }}>
          <input type="checkbox" defaultChecked /> 开启深色模式
        </label>
        <label style={{ display: 'block', marginBottom: '15px' }}>
          <input type="checkbox" /> 接收系统通知
        </label>
      </div>
    </div>
  );
}