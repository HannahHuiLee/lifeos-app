// 文件路径: components/Navbar.tsx (或 src/components/Navbar.tsx)
import Link from 'next/link';

export default function Navbar() {
    return (
        <nav style={{
            display: 'flex',
            gap: '20px',
            padding: '15px 30px',
            backgroundColor: '#1f2937',
            color: 'white',
            fontFamily: 'sans-serif',
            fontSize: '1rem',
            fontWeight: 'bold',
            flexWrap: 'wrap',
            alignItems: 'center',
        }}>
            <Link href="/" style={{ color: '#fbbf24', textDecoration: 'none' }}>🏠 LifeOS 首页</Link>
            <Link href="/create-note" style={{ color: '#34d399', textDecoration: 'none' }}>📝 新建记录</Link>
            <Link href="/reflection" style={{ color: '#60a5fa', textDecoration: 'none' }}>✍️ Reflection</Link>
            <Link href="/history" style={{ color: '#c4b5fd', textDecoration: 'none' }}>📚 History</Link>
            <Link href="/listening" style={{ color: '#f9a8d4', textDecoration: 'none', }}>🎧 Listening Coach</Link>
        </nav>
    );
}