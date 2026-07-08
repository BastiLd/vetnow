import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AdminProvider } from './lib/adminContext.jsx';
import './base.css';
import './redesign.css';

const VALID = ['home','search','results','detail','request','dashboard','owner-messages','auth','login','register-owner','register-clinic','extension','admin'];

function initialRoute() {
  const params = new URLSearchParams(location.search);
  const rawHash = (location.hash || '').replace(/^#\/?/, '');
  const hash = new URLSearchParams(rawHash.includes('=') ? rawHash : '');
  // Pfad- oder Hash-Routing: /admin bzw. #/admin (auch unterhalb des GitHub-Pages-Basispfads)
  const base = import.meta.env.BASE_URL || '/';
  const path = (location.pathname.startsWith(base) ? location.pathname.slice(base.length) : location.pathname.replace(/^\//, '')).replace(/\/$/, '');
  let screen = params.get('screen') || hash.get('screen');
  if (!screen && VALID.includes(path)) screen = path;
  if (!screen && VALID.includes(rawHash)) screen = rawHash;
  const id = params.get('id') || hash.get('id') || undefined;
  return { screen: VALID.includes(screen) ? screen : 'home', id };
}

const { screen, id } = initialRoute();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AdminProvider>
      <App initialScreen={screen} initialId={id} />
    </AdminProvider>
  </React.StrictMode>
);
