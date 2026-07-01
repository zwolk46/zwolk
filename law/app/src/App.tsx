import { BrowserRouter, Route, Routes, useParams } from 'react-router';
import { AppShell } from '@/routes/AppShell';
import Home from '@/routes/Home';
import JurisdictionLanding from '@/routes/JurisdictionLanding';
import Reader from '@/routes/Reader';
import Search from '@/routes/Search';
import Settings from '@/routes/Settings';
import Library from '@/routes/Library';
import Annotations from '@/routes/Annotations';
import Coverage from '@/routes/Coverage';
import MapRoute from '@/routes/Map';
import Alerts from '@/routes/Alerts';
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
          <Route path="/j/:jurId" element={<JurisdictionLandingKeyed />} />
          <Route path="/j/:jurId/n/*" element={<ReaderKeyed />} />
          <Route path="/search" element={<Search />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/library" element={<Library />} />
          <Route path="/annotations" element={<Annotations />} />
          <Route path="/coverage" element={<Coverage />} />
          <Route path="/map" element={<MapRoute />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster richColors />
    </BrowserRouter>
  );
}

// Force React to remount the reader whenever the URL points at a different
// node. Without this, react-router keeps the same Reader instance and the
// content pane can get stuck on a stale node while the sidebar highlight
// and URL update correctly. Cheap and unambiguous — doesn't depend on any
// downstream motion/animation library quirk.
function ReaderKeyed() {
  const params = useParams();
  const splat = params['*'] ?? '';
  return <Reader key={`${params.jurId ?? ''}:${splat}`} />;
}

function JurisdictionLandingKeyed() {
  const params = useParams();
  return <JurisdictionLanding key={params.jurId ?? ''} />;
}
