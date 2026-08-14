import { Outlet } from 'react-router-dom';

export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>JoeKnock Foundation</h1>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
