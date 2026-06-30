import { BrowserRouter, Route, Routes } from 'react-router';
import { AppShell } from '@/routes/AppShell';
import Home from '@/routes/Home';
import JurisdictionLanding from '@/routes/JurisdictionLanding';
import Reader from '@/routes/Reader';
import Search from '@/routes/Search';
import Settings from '@/routes/Settings';
import Library from '@/routes/Library';
import Annotations from '@/routes/Annotations';
import Coverage from '@/routes/Coverage';
import NotFound from '@/routes/NotFound';
import { Toaster } from '@/components/ui/sonner';

// Match Vite's `base` so the SPA mounts cleanly under /law in prod and at /
// in dev. import.meta.env.BASE_URL is '/' in dev and '/law/' after prod build.
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export default function App() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/j/:jurId" element={<JurisdictionLanding />} />
          <Route path="/j/:jurId/n/*" element={<Reader />} />
          <Route path="/search" element={<Search />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/library" element={<Library />} />
          <Route path="/annotations" element={<Annotations />} />
          <Route path="/coverage" element={<Coverage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster richColors />
    </BrowserRouter>
  );
}
