// 文件路径: app/dashboard/page.tsx (或 src/app/dashboard/page.tsx)

export default function DashboardPage() {
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '2rem', color: '#2563eb' }}>📊 仪表盘 (Dashboard)</h1>
      <p style={{ marginTop: '20px', fontSize: '1.2rem', color: '#555' }}>
        欢迎回到 LifeOS！这里是你的系统状态概览。
      </p>
      <div style={{ marginTop: '30px', padding: '20px', background: '#f3f4f6', borderRadius: '8px' }}>
        <p>✅ 核心服务运行正常</p>
        <p>✅ 数据库连接稳定</p>
        <p>⏳ 待处理任务：3 个</p>
      </div>
    </div>
  );
}