import { BrowserRouter, Route, Routes } from 'react-router';
import { AppShell } from '@/routes/AppShell';
import HomePlaceholder from '@/routes/HomePlaceholder';
import JurisdictionLanding from '@/routes/JurisdictionLanding';
import Reader from '@/routes/Reader';
import SearchPlaceholder from '@/routes/SearchPlaceholder';
import Settings from '@/routes/Settings';
import Library from '@/routes/Library';
import Annotations from '@/routes/Annotations';
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
          <Route path="/" element={<HomePlaceholder />} />
          <Route path="/j/:jurId" element={<JurisdictionLanding />} />
          <Route path="/j/:jurId/n/*" element={<Reader />} />
          <Route path="/search" element={<SearchPlaceholder />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/library" element={<Library />} />
          <Route path="/annotations" element={<Annotations />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster richColors />
    </BrowserRouter>
  );
}
