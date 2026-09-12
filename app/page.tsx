import Link from 'next/link';

export default function Home() {
  return (
    <main style={{
      maxWidth: '760px',
      margin: '40px auto',
      padding: '0 20px 60px',
    }}>
      <h1>LifeOS</h1>
      <p>
        LifeOS is a personal AI system for reflection, learning, and agentic workflows.
        It combines structured reflection, evidence-aware AI analysis, resumable English learning, and auditable tool-using agents.
      </p>

      {[
        {
          title: 'Reflection',
          href: '/reflection',
          description: 'Turn personal reflections into structured, evidence-aware insights.',
        },
        {
          title: 'English Learning',
          href: '/listening',
          description: 'Practice Reading and Listening with resumable units, AI feedback, and review.',
        },
        {
          title: 'Agent',
          href: '/agent',
          description: 'Run tool-using workflows with real data and auditable traces.',
        },
      ].map((module) => (
        <section key={module.href} style={{
          marginTop: '24px',
          padding: '20px',
          border: '1px solid #d1d5db',
          borderRadius: '10px',
        }}>
          <h2><Link href={module.href}>{module.title}</Link></h2>
          <p>{module.description}</p>
        </section>
      ))}
    </main>
  );
}
